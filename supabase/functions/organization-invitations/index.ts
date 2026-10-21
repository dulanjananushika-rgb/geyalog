import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const inviteBaseUrl = Deno.env.get('GEYALOG_INVITE_URL');
  const emailFrom = Deno.env.get('GEYALOG_EMAIL_FROM');
  if (!supabaseUrl || !anonKey || !resendKey || !inviteBaseUrl || !emailFrom) {
    return respond({ error: 'Invitation email is not configured. Ask the company owner to contact support.' }, 503);
  }

  let payload: { organizationId?: string; email?: string; role?: string };
  try { payload = await request.json(); } catch { return respond({ error: 'Invalid request' }, 400); }
  if (!payload.organizationId || !payload.email || !['admin', 'site_supervisor', 'accountant'].includes(payload.role ?? '')) {
    return respond({ error: 'Company, email, and permitted role are required' }, 400);
  }

  // The caller's JWT is forwarded to the SECURITY DEFINER RPC. PostgreSQL
  // authorizes the member role and company; the Edge Function never trusts a
  // caller-supplied role or company without that backend check.
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return respond({ error: 'Your session has expired. Sign in again.' }, 401);

  const { data, error } = await client.rpc('create_organization_invitation', {
    target_organization_id: payload.organizationId,
    target_email: payload.email.trim().toLowerCase(),
    target_role: payload.role,
  });
  if (error) return respond({ error: safeDatabaseMessage(error.message) }, 400);
  const invitation = Array.isArray(data) ? data[0] : null;
  if (!invitation?.raw_token || !invitation.invitation_id) return respond({ error: 'Invitation could not be prepared' }, 500);

  const acceptUrl = `${inviteBaseUrl.replace(/\/$/, '')}?token=${encodeURIComponent(invitation.raw_token)}`;
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailFrom,
      to: [payload.email.trim().toLowerCase()],
      subject: 'You are invited to join a GeyaLog company',
      html: `<p>You have been invited to join a construction team on GeyaLog.</p><p><a href="${escapeHtml(acceptUrl)}">Review and accept invitation</a></p><p>This secure link expires in 7 days. If you were not expecting this, ignore this email.</p>`,
    }),
  });
  if (!emailResponse.ok) {
    // Revoke the undelivered invitation so the UI never reports a false send.
    await client.rpc('revoke_organization_invitation', { target_invitation_id: invitation.invitation_id });
    return respond({ error: 'Email delivery failed. Please check the email settings and retry.' }, 502);
  }
  return respond({ invitationId: invitation.invitation_id, delivery: 'sent' }, 200);
});

function respond(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function safeDatabaseMessage(message: string) {
  const allowed = ['Not authorized', 'Admins cannot invite Admins', 'Role is not assignable', 'This person is already an active member', 'Invalid email', 'duplicate key'];
  return allowed.find(item => message.includes(item)) ? message : 'Invitation request could not be completed.';
}
