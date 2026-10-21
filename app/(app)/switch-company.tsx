import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useOrganization } from '@/providers/organization-provider';
import { roleLabels } from '@/lib/permissions';
import { colors, space } from '@/theme/tokens';
export default function SwitchCompanyScreen() {
  const { organizations, organization, loading, setActiveOrganization } = useOrganization();
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text style={styles.back} onPress={() => router.back()}>‹  Back</Text><Text style={styles.title}>Switch company</Text><Text style={styles.sub}>Oya join wela inna workspace ekak select karanna.</Text>{loading ? <ActivityIndicator color={colors.green} /> : organizations.map(company => <Pressable key={company.id} onPress={async () => { await setActiveOrganization(company.id); router.replace('/(app)'); }} style={[styles.row, organization?.id === company.id && styles.active]}><Text style={styles.name}>{company.name}</Text><Text style={styles.role}>{roleLabels[company.role]}</Text></Pressable>)}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg }, back: { color: colors.green, fontWeight: '700', paddingVertical: 12 }, title: { color: colors.ink, fontWeight: '800', fontSize: 28, marginTop: 24 }, sub: { color: colors.muted, marginVertical: 16 }, row: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line }, active: { borderLeftWidth: 3, borderLeftColor: colors.green, paddingLeft: 12 }, name: { color: colors.ink, fontWeight: '700', fontSize: 16 }, role: { color: colors.muted, marginTop: 4 } });
