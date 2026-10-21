import { useState } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Brand, ErrorNote, Field } from '@/components/ui';
import { signInSchema } from '@/lib/auth-validation';
import { friendlyAuthError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

export default function SignInScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return; setError('');
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Details check karanna.'); return; }
    if (!supabase) { setError('Supabase setup karala app eka restart karanna.'); return; }
    setLoading(true);
    try { const { error: authError } = await supabase.auth.signInWithPassword(parsed.data); if (authError) throw authError; if (token) router.replace({ pathname: '/invite', params: { token } }); }
    catch (e) { setError(friendlyAuthError(e instanceof Error ? e as Error & { status?: number; code?: string } : {})); }
    finally { setLoading(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Brand /><Text style={styles.heading}>Welcome back</Text><Text style={styles.sub}>Account ekata sign in wenna.</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}<Field label="Email address" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} /><Field label="Password" placeholder="Your password" secureTextEntry value={password} onChangeText={setPassword} /><Text style={styles.link} onPress={() => router.push('/(public)/forgot-password')}>Password amathaka unada?</Text><Button title="Sign in" onPress={submit} loading={loading} /><View style={styles.bottom}><Text style={styles.muted}>Account ekak nadda? </Text><Link href="/(public)/sign-up" style={styles.link}>Create account</Link></View></ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, padding: space.lg, paddingTop: 34, justifyContent: 'center' }, heading: { fontSize: 30, fontWeight: '800', color: colors.ink, marginTop: 50 }, sub: { fontSize: 15, color: colors.muted, marginTop: 8, marginBottom: 30 }, link: { color: colors.green, fontWeight: '700', marginBottom: 22 }, bottom: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 }, muted: { color: colors.muted } });
