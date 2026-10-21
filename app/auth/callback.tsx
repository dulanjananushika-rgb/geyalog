import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Brand } from '@/components/ui';
import { colors, space } from '@/theme/tokens';
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; intent?: string; token?: string; error_description?: string }>();
  const [message, setMessage] = useState('Verification link eka check karanawa…');
  useEffect(() => {
    let live = true;
    async function resolve() {
      if (params.error_description) { setMessage('Link eka expire wela ho invalid. Sign in page eken resend/recovery option use karanna.'); return; }
      if (!supabase || !params.code) { setMessage('Auth link eka complete naha. Email eke link eka aye open karanna.'); return; }
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (!live) return;
      if (error) { setMessage('Link eka expire wela ho already use karala. Nawatha sign in wenna.'); return; }
      if (params.intent === 'invite' && params.token) router.replace({ pathname: '/invite', params: { token: params.token } });
      else if (params.intent === 'recovery') router.replace('/(app)/reset-password');
      else router.replace('/(app)');
    }
    void resolve(); return () => { live = false; };
  }, [params.code, params.intent, params.token, params.error_description]);
  return <SafeAreaView style={styles.page}><Brand /><ActivityIndicator color={colors.green} size="large" /><Text style={styles.message}>{message}</Text></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, paddingTop: 32, justifyContent: 'center', gap: 18 }, message: { textAlign: 'center', color: colors.muted, lineHeight: 22 } });
