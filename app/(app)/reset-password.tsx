import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorNote, Field } from '@/components/ui';
import { resetPasswordSchema } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
export default function ResetPasswordScreen() {
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [loading, setLoading] = useState(false);
  async function save() {
    if (loading) return; setError(''); const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Password eka check karanna.'); return; }
    if (!supabase) { setError('Supabase setup karala app eka restart karanna.'); return; }
    setLoading(true); try { const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password }); if (updateError) throw updateError; setDone(true); }
    catch { setError('Password update karanna bari una. Reset email eke aluth link ekak request karanna.'); }
    finally { setLoading(false); }
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Text style={styles.title}>Aluth password eka set karanna</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}{done ? <Text style={styles.success}>Password eka update una. Dan sign in wenna.</Text> : <><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry /><Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry /><Button title="Update password" loading={loading} onPress={save} /></>}{done ? <Button title="Go to workspace" onPress={() => router.replace('/(app)')} /> : null}</KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, justifyContent: 'center' }, title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginBottom: 24 }, success: { color: colors.green, marginBottom: 20 } });
