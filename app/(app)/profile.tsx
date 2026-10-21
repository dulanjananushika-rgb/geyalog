import { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Brand, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '@/lib/profile';
import { colors, space } from '@/theme/tokens';
export default function ProfileScreen() {
  const { session } = useSession(); const [loading, setLoading] = useState(false);
  const profile = useQuery({ queryKey: ['profile', session?.user.id], enabled: Boolean(session), queryFn: () => getMyProfile(session!.user.id) });
  async function signOut() { if (!supabase || loading) return; setLoading(true); const { error } = await supabase.auth.signOut(); setLoading(false); if (error) Alert.alert('Sign out failed', 'Try again when the connection is available.'); }
  return <SafeAreaView style={styles.page}><Text style={styles.back} onPress={() => router.back()}>‹  Back</Text><Brand /><Text style={styles.title}>Profile & settings</Text>{profile.isLoading ? <ActivityIndicator color={colors.green} /> : profile.error ? <Text style={styles.note}>Profile eka load karanna bari una. Migration saha internet check karanna.</Text> : <><View style={styles.item}><Text style={styles.label}>Full name</Text><Text style={styles.value}>{profile.data?.full_name || 'Name not set'}</Text></View><View style={styles.item}><Text style={styles.label}>Email</Text><Text style={styles.value}>{session?.user.email}</Text></View><View style={styles.item}><Text style={styles.label}>Preferred language</Text><Text style={styles.value}>{profile.data?.preferred_language.toUpperCase()}</Text></View><View style={styles.item}><Text style={styles.label}>Account created</Text><Text style={styles.value}>{profile.data?.created_at.slice(0, 10)}</Text></View><Button title="Edit profile" variant="quiet" onPress={() => router.push('/(app)/edit-profile')} /></>}<View style={{ height: 14 }} /><Button title="Sign out" variant="quiet" loading={loading} onPress={signOut} /></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg }, back: { color: colors.green, fontWeight: '700', paddingVertical: 14, marginBottom: 14 }, title: { color: colors.ink, fontWeight: '800', fontSize: 27, marginTop: 36, marginBottom: 24 }, item: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 15 }, label: { color: colors.muted, fontSize: 12 }, value: { color: colors.ink, fontWeight: '700', marginTop: 5 }, note: { color: colors.muted, marginTop: 18, marginBottom: 28, lineHeight: 20 } });
