import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorNote, SectionTitle } from '@/components/ui';
import { listRequisitions } from '@/lib/materials';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function RequisitionsScreen() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const query = useQuery({ queryKey: ['organization-scoped', orgId, 'material-requisitions'], enabled: Boolean(orgId), queryFn: () => listRequisitions(orgId!) });
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>PROJECT MATERIAL REQUESTS</Text>
    <SectionTitle title="Requisitions" trailing={<Pressable onPress={() => router.push('/(app)/materials/requisitions/new')}><Text style={styles.link}>＋ New</Text></Pressable>} />
    <Text style={styles.body}>Site request review karala approve/reject karanna. Approval eka purchase order ekak ho material purchase ekak create karanne naha.</Text>
    {query.isLoading ? <ActivityIndicator color={colors.green} /> : null}
    {query.error ? <ErrorNote>{query.error instanceof Error ? query.error.message : 'Requests load karanna bari una.'}</ErrorNote> : null}
    {!query.isLoading && !query.error && !query.data?.length ? <View style={styles.empty}><Text style={styles.title}>Requests thama naha</Text><Text style={styles.body}>Site team eken request ekak submit kala passe me thanata enawa.</Text></View> : null}
    {query.data?.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/(app)/materials/requisitions/[id]', params: { id: item.id } })} style={styles.row}>
      <View style={styles.main}><Text style={styles.title}>{item.request_reference}</Text><Text style={styles.body}>{item.status.replaceAll('_', ' ').toUpperCase()} · Needed by {item.needed_by ?? 'not set'}</Text><Text style={styles.body}>{item.delivery_location ?? 'Delivery location not set'}</Text>{item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}</View>
      <Text style={styles.link}>Details →</Text>
    </Pressable>)}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingBottom: 40 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: colors.green, fontWeight: '800', marginBottom: 10 }, link: { color: colors.green, fontWeight: '800', marginTop: 8 }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, empty: { paddingVertical: 24, borderTopWidth: 1, borderColor: colors.line }, row: { paddingVertical: 16, borderTopWidth: 1, borderColor: colors.line }, main: { flex: 1 }, title: { color: colors.ink, fontWeight: '700', fontSize: 15 } });
