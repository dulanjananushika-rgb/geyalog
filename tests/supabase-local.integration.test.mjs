import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const enabled = process.env.GEYALOG_RUN_LOCAL_SUPABASE_TESTS === '1';
const url = process.env.GEYALOG_LOCAL_SUPABASE_URL;
const anonKey = process.env.GEYALOG_LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.GEYALOG_LOCAL_SUPABASE_SERVICE_ROLE_KEY;

test('local Supabase auth, tenant isolation, and Phase 2 organization controls', { skip: !enabled }, async () => {
  assert.equal(url, 'http://127.0.0.1:54321', 'Integration tests are restricted to local Supabase.');
  assert.ok(anonKey, 'A local anon key is required.');
  assert.ok(serviceRoleKey, 'A local service-role key is required for isolated fixture setup.');

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userA = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userB = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suffix = randomUUID();
  const emailA = `rls-a-${suffix}@example.test`;
  const emailB = `rls-b-${suffix}@example.test`;
  const password = `Local-test-${randomUUID()}!`;
  const organizationIds = [];
  const userIds = [];

  try {
    const { data: createdA, error: createAError } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Local RLS Test A' },
    });
    assert.ifError(createAError);
    userIds.push(createdA.user.id);

    const { data: createdB, error: createBError } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Local RLS Test B' },
    });
    assert.ifError(createBError);
    userIds.push(createdB.user.id);

    const { error: loginAError } = await userA.auth.signInWithPassword({ email: emailA, password });
    assert.ifError(loginAError);
    const { error: loginBError } = await userB.auth.signInWithPassword({ email: emailB, password });
    assert.ifError(loginBError);

    const { data: profileA, error: profileAError } = await userA
      .from('profiles')
      .select('id, full_name')
      .eq('id', createdA.user.id)
      .single();
    assert.ifError(profileAError);
    assert.equal(profileA.full_name, 'Local RLS Test A');

    const { data: otherProfile, error: otherProfileError } = await userA
      .from('profiles')
      .select('id')
      .eq('id', createdB.user.id);
    assert.ifError(otherProfileError);
    assert.deepEqual(otherProfile, [], 'A user cannot read another user profile.');

    const { data: organizationA, error: organizationAError } = await userA.rpc(
      'create_organization',
      { org_name: `Local RLS A ${suffix}`, org_business_type: 'individual_contractor', org_phone: null, org_email: null, org_address: null, org_district: null, org_registration_number: null, org_description: null, org_language: 'en' },
    );
    assert.ifError(organizationAError);
    organizationIds.push(organizationA);

    const { data: organizationB, error: organizationBError } = await userB.rpc(
      'create_organization',
      { org_name: `Local RLS B ${suffix}`, org_business_type: 'construction_company', org_phone: null, org_email: null, org_address: null, org_district: null, org_registration_number: null, org_description: null, org_language: 'si' },
    );
    assert.ifError(organizationBError);
    organizationIds.push(organizationB);

    const { data: projectA, error: projectInsertError } = await userA
      .from('projects')
      .insert({
        organization_id: organizationA,
        name: 'Local RLS isolation project',
        customer_name: 'Synthetic Customer',
        location: 'Synthetic location',
        contract_type: 'full',
        pricing_model: 'fixed_price',
        payment_arrangement: 'as_agreed',
      })
      .select('id')
      .single();
    assert.ifError(projectInsertError);
    assert.ok(projectA.id);

    const { data: leakedToB, error: readBError } = await userB
      .from('projects')
      .select('id')
      .eq('organization_id', organizationA);
    assert.ifError(readBError);
    assert.deepEqual(leakedToB, [], 'Company B cannot read Company A projects.');

    const { error: crossCompanyInsertError } = await userA.from('projects').insert({
      organization_id: organizationB,
      name: 'Unauthorized cross-company project',
      customer_name: 'Synthetic Customer',
      location: 'Synthetic location',
      contract_type: 'full',
      pricing_model: 'fixed_price',
      payment_arrangement: 'as_agreed',
    });
    assert.ok(crossCompanyInsertError, 'A user cannot insert into another company.');

    const { data: membershipsA, error: membershipsAError } = await userA.from('organization_members').select('role,status').eq('organization_id', organizationA);
    assert.ifError(membershipsAError);
    assert.deepEqual(membershipsA, [{ role: 'owner', status: 'active' }], 'The company creator is assigned Owner atomically.');

    const { data: invite, error: inviteError } = await userA.rpc('create_organization_invitation', {
      target_organization_id: organizationA, target_email: emailB, target_role: 'accountant',
    });
    assert.ifError(inviteError);
    assert.ok(invite?.[0]?.raw_token, 'Only the authorized invitation creator receives the one-time token.');

    const { error: invalidTokenError } = await userB.rpc('accept_organization_invitation', { raw_invitation_token: 'not-a-valid-token' });
    assert.ok(invalidTokenError, 'Invalid invitation tokens are rejected.');
    const { data: acceptedCompany, error: acceptError } = await userB.rpc('accept_organization_invitation', { raw_invitation_token: invite[0].raw_token });
    assert.ifError(acceptError);
    assert.equal(acceptedCompany, organizationA, 'The invited account joins the intended company.');

    const { data: companyARead, error: readAfterJoinError } = await userB.from('projects').select('id').eq('organization_id', organizationA);
    assert.ifError(readAfterJoinError);
    assert.deepEqual(companyARead, [{ id: projectA.id }], "An invited accountant can read the company's project data.");

    const { error: selfPromotionError } = await userB.rpc('change_organization_member_role', {
      target_organization_id: organizationA, target_user_id: createdB.user.id, new_role: 'admin',
    });
    assert.ok(selfPromotionError, 'A member cannot promote themselves.');

    const { error: ownerRemovalError } = await userA.rpc('set_organization_member_status', {
      target_organization_id: organizationA, target_user_id: createdA.user.id, new_status: 'removed',
    });
    assert.ok(ownerRemovalError, 'The Owner cannot remove their own only Owner membership.');

    const { error: suspendedError } = await userA.rpc('set_organization_member_status', {
      target_organization_id: organizationA, target_user_id: createdB.user.id, new_status: 'suspended',
    });
    assert.ifError(suspendedError);
    const { data: lostAccess, error: afterSuspensionError } = await userB.from('organizations').select('id').eq('id', organizationA);
    assert.ifError(afterSuspensionError);
    assert.deepEqual(lostAccess, [], 'Suspended members immediately lose organization access.');
  } finally {
    if (organizationIds.length) {
      await admin.from('organizations').delete().in('id', organizationIds);
    }
    for (const userId of userIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
});
