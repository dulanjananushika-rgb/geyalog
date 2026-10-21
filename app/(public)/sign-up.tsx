import { useState } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { Brand, Button, ErrorNote, Field } from '@/components/ui';
import { signUpSchema } from '@/lib/auth-validation';
import { friendlyAuthError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

export default function SignUpScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return; setError('');
    const parsed = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Details check karanna.'); return; }
    if (!supabase) { setError('Supabase setup karala app eka restart karanna.'); return; }
    setLoading(true);
    try {
      const callback = Linking.createURL(`auth/callback${token ? `?intent=invite&token=${encodeURIComponent(token)}` : ''}`);
      const { data, error: authError } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: callback, data: { full_name: parsed.data.fullName } } });
      if (authError) throw authError;
      if (data.session && token) router.replace({ pathname: '/invite', params: { token } });
      else if (!data.session) router.replace({ pathname: '/(public)/verify-email', params: { email: parsed.data.email, token } });
    } catch (e) { setError(friendlyAuthError(e instanceof Error ? e as Error & { status?: number; code?: string } : {})); }
    finally { setLoading(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Brand /><Text style={styles.heading}>Create your account</Text><Text style={styles.sub}>GeyaLog workspace ekata yamu.</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}<Field label="Full name" placeholder="Nimal Perera" value={fullName} onChangeText={setFullName} autoCapitalize="words" /><Field label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><Field label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry /><Text style={styles.hint}>Letters saha numbers mix karala strong password ekak use karanna.</Text><Field label="Confirm password" placeholder="Password eka aye type karanna" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry /><Button title="Create account" onPress={submit} loading={loading} /><Text style={styles.bottom}>Account thiyenawada? <Link href="/(public)/sign-in" style={styles.link}>Sign in</Link></Text></ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, padding: space.lg, paddingTop: 28, justifyContent: 'center' }, heading: { fontSize: 30, fontWeight: '800', color: colors.ink, marginTop: 38 }, sub: { fontSize: 15, color: colors.muted, marginTop: 8, marginBottom: 24 }, hint: { color: colors.muted, fontSize: 12, marginTop: -5, marginBottom: 12 }, bottom: { textAlign: 'center', color: colors.muted, marginTop: 22 }, link: { color: colors.green, fontWeight: '700' } });
