import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Brand, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
export default function VerifyEmailScreen() {
  const { email, token } = useLocalSearchParams<{ email?: string; token?: string }>(); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  async function resend() { if (!email || !supabase || loading) return; setLoading(true); try { await supabase.auth.resend({ type: 'signup', email }); setSent(true); } finally { setLoading(false); } }
  return <SafeAreaView style={styles.page}><Brand /><View style={styles.body}><Text style={styles.icon}>✉</Text><Text style={styles.title}>Email eka verify karanna</Text><Text style={styles.text}>Verification link eka {email ? `${email} ta` : 'oyage email ekata'} yawwa. Inbox saha spam folder balala link eka open karanna.</Text>{sent ? <Text style={styles.success}>Email eka aye yawwa. Inbox eka check karanna.</Text> : null}<Button title="Verification email aye yawanna" variant="quiet" loading={loading} onPress={resend} />{token ? <Link href={{ pathname: '/(public)/sign-in', params: { token } }} style={styles.note}>Verification passe sign in karala invitation eka accept karanna.</Link> : <Text style={styles.note}>Link eka expire nam, Sign in screen eken reset/recovery help ganna.</Text>}</View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, paddingTop: 32 }, body: { flex: 1, justifyContent: 'center' }, icon: { fontSize: 42, color: colors.green }, title: { fontSize: 29, color: colors.ink, fontWeight: '800', marginTop: 20 }, text: { color: colors.muted, fontSize: 15, lineHeight: 24, marginVertical: 14 }, success: { color: colors.green, marginBottom: 16 }, note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18 } });
