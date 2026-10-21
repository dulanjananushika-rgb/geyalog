import { useEffect } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Brand, Button, SectionTitle } from '@/components/ui';
import { colors, radius, space } from '@/theme/tokens';
import { useOrganization } from '@/providers/organization-provider';
import { useSession } from '@/providers/session-provider';
import { roleLabels } from '@/lib/permissions';

export default function CompanyHome() {
  const { organizations, organization, loading, error } = useOrganization();
  const { session } = useSession();
  useEffect(() => { if (!loading && !error && organizations.length === 0) router.replace('/(app)/setup-company'); }, [loading, error, organizations.length]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  if (!organization) return <SafeAreaView style={styles.page}><Brand /><Text style={styles.title}>Workspace eka load karanna bari una</Text><Text style={styles.text}>{error?.message ?? 'Internet connection eka check karala retry karanna.'}</Text><Button title="Retry" onPress={() => router.replace('/(app)')} /></SafeAreaView>;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><View style={styles.top}><Brand compact /><Pressable onPress={() => router.push('/(app)/profile')} style={styles.avatar}><Text style={styles.avatarText}>{session?.user.email?.[0]?.toUpperCase() ?? 'U'}</Text></Pressable></View>
    <Text style={styles.eyebrow}>COMPANY WORKSPACE</Text><Text style={styles.title}>{organization.name}</Text><Text style={styles.role}>{roleLabels[organization.role]}</Text>
    {organizations.length > 1 ? <Pressable onPress={() => router.push('/(app)/switch-company')} style={styles.switch}><Text style={styles.switchText}>Switch company  ›</Text></Pressable> : null}
    <View style={styles.actions}><SectionTitle eyebrow="TEAM" title="People working together" /><Button title="Manage team" variant="quiet" onPress={() => router.push('/(app)/team')} /></View>
    <View style={{ marginTop: 32, gap: 12 }}><SectionTitle eyebrow="WORK" title="Construction projects" /><Button title="Open projects" onPress={() => router.push('/(app)/projects')} /></View>
    <View style={{ marginTop: 32, gap: 12 }}><SectionTitle eyebrow="CUSTOMER FINANCE" title="Payments" /><Button title="Open customer payments" variant="quiet" onPress={() => router.push('/(app)/payments')} /></View>
    <View style={{ marginTop: 32, gap: 12 }}><SectionTitle eyebrow="SITE OPERATIONS" title="Workers & attendance" /><Button title="Open workforce" variant="quiet" onPress={() => router.push('/(app)/workforce')} /></View>
    <View style={{ marginTop: 32, gap: 12 }}><SectionTitle eyebrow="SUPPLIERS & STOCK" title="Materials procurement" /><Button title="Open materials" variant="quiet" onPress={() => router.push('/(app)/materials')} /></View>
    <View style={styles.empty}><View style={styles.rule} /><Text style={styles.emptyTitle}>Workspace ready</Text><Text style={styles.text}>Projects, customer payments saha workforce features me company workspace ekata attach wenawa. Company data access eka membership permissions anuwa control wenawa.</Text><Text style={styles.note}>Project create karanna Projects entry eka use karanna.</Text></View>
    <Pressable onPress={() => router.push('/(app)/company-settings')} style={styles.settings}><Text style={styles.settingsText}>Company settings  →</Text></Pressable>
    <Pressable onPress={() => router.push('/(app)/profile')} style={styles.settings}><Text style={styles.settingsText}>Profile & settings  →</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingBottom: 36 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 46 }, avatar: { width: 42, height: 42, borderRadius: 22, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: colors.green, fontWeight: '800', fontSize: 17 }, eyebrow: { color: colors.green, fontSize: 10, letterSpacing: 1.6, fontWeight: '800' }, title: { color: colors.ink, fontWeight: '800', fontSize: 30, letterSpacing: -0.8, marginTop: 8 }, role: { color: colors.muted, fontSize: 14, marginTop: 6 }, switch: { alignSelf: 'flex-start', marginTop: 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.mint }, switchText: { color: colors.green, fontWeight: '700', fontSize: 13 }, actions: { marginTop: 38, gap: 12 }, empty: { marginTop: 54, paddingTop: 18 }, rule: { width: 44, height: 3, backgroundColor: colors.gold, borderRadius: 2, marginBottom: 17 }, emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 19 }, text: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 9 }, note: { color: colors.green, fontSize: 12, marginTop: 14 }, settings: { marginTop: 34, paddingVertical: 14, borderTopColor: colors.line, borderTopWidth: 1 }, settingsText: { color: colors.green, fontWeight: '700' } });
