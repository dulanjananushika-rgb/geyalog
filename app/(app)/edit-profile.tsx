import { useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field } from '@/components/ui';
import { profileSchema, type ProfileInput } from '@/lib/auth-validation';
import { getMyProfile, updateMyProfile } from '@/lib/profile';
import { useSession } from '@/providers/session-provider';
import { colors, space } from '@/theme/tokens';
export default function EditProfileScreen() {
  const { session } = useSession(); const profile = useQuery({ queryKey: ['profile', session?.user.id], enabled: Boolean(session), queryFn: () => getMyProfile(session!.user.id) });
  if (profile.isLoading) return <ActivityIndicator style={{ flex: 1 }} color={colors.green} />;
  if (!profile.data) return <SafeAreaView style={styles.page}><Text style={styles.emailLabel}>Profile eka load wenne naha.</Text></SafeAreaView>;
  return <EditProfileForm key={profile.data.id} initial={{ fullName: profile.data.full_name, preferredLanguage: profile.data.preferred_language }} userId={profile.data.id} />;
}
function EditProfileForm({ initial, userId }: { initial: ProfileInput; userId: string }) {
  const queryClient = useQueryClient(); const [form, setForm] = useState<ProfileInput>(initial); const [error, setError] = useState('');
  const save = useMutation({ mutationFn: async () => { const result = profileSchema.safeParse(form); if (!result.success) throw new Error(result.error.issues[0]?.message); return updateMyProfile(userId, result.data); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['profile', userId] }); router.back(); }, onError: e => setError(e instanceof Error ? e.message : 'Profile save karanna bari una.') });
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text style={styles.back} onPress={() => router.back()}>‹  Profile</Text><Text style={styles.title}>Edit profile</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}<Field label="Full name" value={form.fullName} onChangeText={fullName => setForm(prev => ({ ...prev, fullName }))} /><ChoiceGroup label="Preferred language" value={form.preferredLanguage} onChange={preferredLanguage => setForm(prev => ({ ...prev, preferredLanguage }))} options={[{ value: 'en', label: 'English' }, { value: 'si', label: 'Sinhala' }, { value: 'ta', label: 'Tamil' }]} /><Text style={styles.emailLabel}>Email update karanna Auth security flow eka use karanna one; me profile form eken edit karanna ba.</Text><Button title="Save profile" loading={save.isPending} onPress={() => { setError(''); save.mutate(); }} /></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingTop: 30 }, back: { color: colors.green, fontWeight: '700', paddingVertical: 12 }, title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginTop: 20, marginBottom: 24 }, emailLabel: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 } });
