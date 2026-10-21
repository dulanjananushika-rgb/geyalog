import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { Brand, Button, ErrorNote, Field } from '@/components/ui';
import { emailSchema } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return; setError(''); const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Email eka check karanna.'); return; }
    if (!supabase) { setError('Supabase setup karala app eka restart karanna.'); return; }
    setLoading(true);
    try { const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: Linking.createURL('auth/callback?intent=recovery') }); if (resetError) throw resetError; setSent(true); }
    catch { setError('Reset email eka send karanna bari una. Internet saha Supabase Auth settings check karanna.'); }
    finally { setLoading(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Text style={styles.back}><Link href="/(public)/sign-in">‹  Sign in</Link></Text><Brand /><Text style={styles.title}>Password reset</Text><Text style={styles.sub}>Account email eka enter karanna. Reset link ekak yawanawa if account eka match wenawanam.</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}{sent ? <Text style={styles.success}>Request eka process una. Email inbox saha spam folder check karanna.</Text> : null}<Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" /><Button title="Send reset link" loading={loading} onPress={submit} /></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, paddingTop: 34 }, back: { marginBottom: 28, color: colors.green }, title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginTop: 38 }, sub: { color: colors.muted, lineHeight: 22, marginTop: 9, marginBottom: 25 }, success: { color: colors.green, marginBottom: 14 } });
