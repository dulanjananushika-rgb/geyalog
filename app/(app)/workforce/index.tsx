import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, ErrorNote, SectionTitle } from '@/components/ui';
import { listWorkers } from '@/lib/workforce';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function WorkforceScreen() {
  const { organization } = useOrganization();
  const query = useQuery({ queryKey: ['organization-scoped', organization?.id, 'workers'], enabled: Boolean(organization), queryFn: () => listWorkers(organization!.id) });
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>PHASE 5 · SITE OPERATIONS</Text><SectionTitle title="Workers" />
    <Text style={styles.intro}>Company worker directory eka saha site attendance records balanna.</Text>
    <View style={styles.actions}><Button title="Add worker" onPress={() => router.push('/(app)/workforce/new-worker')} /><Button title="Assign to project & set rate" variant="quiet" onPress={() => router.push('/(app)/workforce/assign')} /><Button title="Change dated wage rate" variant="quiet" onPress={() => router.push('/(app)/workforce/rates')} /><Button title="Record attendance" variant="quiet" onPress={() => router.push('/(app)/workforce/attendance')} /><Button title="Review attendance" variant="quiet" onPress={() => router.push('/(app)/workforce/attendance-review')} /><Button title="Task-based work" variant="quiet" onPress={() => router.push('/(app)/workforce/tasks')} /><Button title="Subcontractors" variant="quiet" onPress={() => router.push('/(app)/workforce/subcontractors')} /><Button title="Advances & settlements" variant="quiet" onPress={() => router.push('/(app)/workforce/payments')} /><Button title="Labour costs & worker history" variant="quiet" onPress={() => router.push('/(app)/workforce/reporting')} /></View>
    <SectionTitle eyebrow="DIRECTORY" title="Team" />
    {query.isLoading ? <ActivityIndicator color={colors.green} /> : null}
    {query.error ? <ErrorNote>{query.error instanceof Error ? query.error.message : 'Workers load karanna bari una.'}</ErrorNote> : null}
    {!query.isLoading && !query.error && !query.data?.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Worker records thama naha</Text><Text style={styles.body}>Pahadili worker directory ekak hadanna “Add worker” use karanna. Real company data witharai pennanne.</Text></View> : null}
    {query.data?.map(worker => <View key={worker.id} style={styles.row}><View style={styles.avatar}><Text style={styles.avatarText}>{worker.full_name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.rowMain}><Text style={styles.name}>{worker.full_name}</Text><Text style={styles.body}>{worker.skill_category} · {worker.engagement_type.replaceAll('_', ' ')}</Text>{worker.phone ? <Text style={styles.body}>{worker.phone}</Text> : null}</View><Text style={styles.status}>{worker.status === 'active' ? 'ACTIVE' : 'INACTIVE'}</Text></View>)}
    <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Workspace</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingBottom: 40 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: colors.green, fontWeight: '800', marginBottom: 10 }, intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: -5, marginBottom: 22 }, actions: { gap: 10, marginBottom: 32 }, empty: { paddingVertical: 24, borderTopWidth: 1, borderColor: colors.line }, emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' }, body: { color: colors.muted, fontSize: 13, marginTop: 5, lineHeight: 20 }, row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderColor: colors.line, gap: 12 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.green, fontWeight: '800', fontSize: 17 }, rowMain: { flex: 1 }, name: { color: colors.ink, fontWeight: '700', fontSize: 15 }, status: { color: colors.green, fontSize: 9, letterSpacing: 1, fontWeight: '800' }, back: { marginTop: 28, paddingVertical: 12 }, backText: { color: colors.green, fontWeight: '700' } });
