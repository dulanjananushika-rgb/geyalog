import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { getProjectOverview } from '@/lib/project-management';
import { fetchProjectPnlSummary } from '@/lib/project-pnl';
import { useOrganization } from '@/providers/organization-provider';
import { colors, radius, space } from '@/theme/tokens';
function formatLkr(value: string | null | undefined) {
  if (!value) return null;
  const [whole, decimal] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(decimal ?? '00').padEnd(2, '0').slice(0, 2)}`;
}
export default function ProjectOverviewScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>(); const { organization } = useOrganization();
  const query = useQuery({ queryKey: ['organization-scoped', organization?.id, 'project', projectId], enabled: Boolean(organization && projectId), queryFn: () => getProjectOverview(organization!.id, projectId) });
  const pnlQuery = useQuery({ queryKey: ['organization-scoped', organization?.id, 'project-pnl', projectId], enabled: Boolean(organization && projectId), queryFn: () => fetchProjectPnlSummary(organization!.id, projectId) });
  if (query.isLoading) return <View style={styles.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  if (query.error || !query.data) return <SafeAreaView style={styles.page}><Text style={styles.back} onPress={() => router.back()}>‹  Projects</Text><Text style={styles.title}>Project eka load karanna bari una</Text><Text style={styles.body}>Access permission, connection saha migration check karala nawatha try karanna.</Text><Button title="Retry" variant="quiet" onPress={() => void query.refetch()} /></SafeAreaView>;
  const p = query.data; const contractAmount = formatLkr(p.contract?.agreed_value); const revised = formatLkr(p.contract?.revised_agreed_value); const variations = formatLkr(p.contract?.approved_variation_total);
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text style={styles.back} onPress={() => router.back()}>‹  Projects</Text><Text style={styles.ref}>{p.project_reference} · {p.status.replaceAll('_', ' ').toUpperCase()}</Text><Text style={styles.title}>{p.name}</Text><Text style={styles.customer}>{p.customer_name}</Text><Text style={styles.body}>{p.location}{p.district ? `, ${p.district}` : ''}</Text>
    <View style={styles.meta}><Text style={styles.metaText}>{p.contract_type.replaceAll('_', ' ')} contract</Text><Text style={styles.metaText}>{p.pricing_model.replaceAll('_', ' ')}</Text></View>
    <View style={styles.quickNav}>
      <Pressable style={styles.navCard} onPress={() => router.push({ pathname: '/(app)/projects/diary', params: { projectId } })}>
        <Text style={styles.navIcon}>📅</Text>
        <Text style={styles.navTitle}>Daily Site Diary</Text>
        <Text style={styles.navSub}>Weather & work log</Text>
      </Pressable>
      <Pressable style={styles.navCard} onPress={() => router.push({ pathname: '/(app)/projects/attachments', params: { projectId } })}>
        <Text style={styles.navIcon}>📸</Text>
        <Text style={styles.navTitle}>Site Photos</Text>
        <Text style={styles.navSub}>Media & documents</Text>
      </Pressable>
    </View>

    {pnlQuery.data && (
      <View style={styles.pnlCard}>
        <View style={styles.pnlHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pnlTitle}>Budget vs. Actual (P&L)</Text>
            <Text style={styles.pnlSub}>Real-time profitability & costs</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: pnlQuery.data.isProfitable ? colors.mint : colors.goldWash }]}>
            <Text style={[styles.badgeText, { color: pnlQuery.data.isProfitable ? colors.green : colors.gold }]}>
              {pnlQuery.data.profitMarginPercent.toFixed(1)}% Margin
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Agreed Contract</Text>
            <Text style={styles.metricValue}>{pnlQuery.data.contractValueDisplay}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Projected Profit</Text>
            <Text style={[styles.metricValue, { color: pnlQuery.data.isProfitable ? colors.green : colors.red }]}>
              {pnlQuery.data.projectedProfitDisplay}
            </Text>
          </View>
        </View>

        <View style={styles.costBreakdown}>
          <Text style={styles.costTitle}>Expenses Breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>📦 Materials (Purchase Orders)</Text>
            <Text style={styles.costVal}>{pnlQuery.data.materialsCostDisplay}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>👷 Labour (Wages & Subcontract)</Text>
            <Text style={styles.costVal}>{pnlQuery.data.labourCostDisplay}</Text>
          </View>
          <View style={[styles.costRow, styles.costTotalRow]}>
            <Text style={styles.costTotalLabel}>Total Expenses</Text>
            <Text style={styles.costTotalVal}>{pnlQuery.data.totalCostDisplay}</Text>
          </View>
        </View>

        <View style={styles.cashFlowBox}>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Customer Inflows Received</Text>
            <Text style={[styles.costVal, { color: colors.green }]}>{pnlQuery.data.revenueReceivedDisplay}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Outstanding Balance Due</Text>
            <Text style={styles.costVal}>{pnlQuery.data.revenueOutstandingDisplay}</Text>
          </View>
          <View style={[styles.costRow, styles.costTotalRow]}>
            <Text style={styles.costTotalLabel}>Net Cash Flow</Text>
            <Text style={[styles.costTotalVal, { color: pnlQuery.data.cashFlowMinor >= 0n ? colors.green : colors.red }]}>
              {pnlQuery.data.cashFlowDisplay}
            </Text>
          </View>
        </View>
      </View>
    )}

    <View style={styles.section}><Text style={styles.sectionTitle}>Contract summary</Text>{p.contract ? <><Value label="Original agreed amount" value={contractAmount ? `LKR ${contractAmount}` : 'Not agreed / variable'} /><Value label="Approved variations" value={`LKR ${variations ?? '0.00'}`} /><Value label="Revised agreed amount" value={revised ? `LKR ${revised}` : 'Not yet determinable'} /><Text style={styles.hint}>Draft / estimated amounts are not shown as guaranteed contract value.</Text></> : <Text style={styles.body}>Contract finance details are restricted or not set yet.</Text>}<Text style={styles.body}>Pricing: {p.pricing_model === 'cost_plus' && p.contract?.cost_plus_formula ? p.contract.cost_plus_formula : p.pricing_model.replaceAll('_', ' ')}</Text></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Timeline</Text><Value label="Expected start" value={p.expected_start_date ?? 'Not set'} /><Value label="Expected completion" value={p.expected_end_date ?? 'Not set'} /></View>
    <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Planned stages</Text><Pressable onPress={() => router.push({ pathname: '/(app)/project-planning', params: { projectId } })}><Text style={styles.link}>Manage</Text></Pressable></View>{p.milestones.length ? p.milestones.map(m => <Value key={m.id} label={`${m.position + 1}. ${m.name}`} value={m.planned_end_date ?? 'Date not set'} />) : <Text style={styles.body}>Milestones plan karala naha. Construction ekata galapena stages add karanna.</Text>}</View>
    <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Work scope</Text><Pressable onPress={() => router.push({ pathname: '/(app)/project-planning', params: { projectId } })}><Text style={styles.link}>Manage</Text></Pressable></View>{p.scope.length ? p.scope.map(s => <Value key={s.id} label={s.description} value={`${s.inclusion} · Materials: ${s.material_responsibility} · Labour: ${s.labour_responsibility}`} />) : <Text style={styles.body}>Scope items add karala naha.</Text>}</View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Payment agreement</Text>{p.paymentTerms.length ? p.paymentTerms.map(t => <Value key={t.id} label={`${t.description} · ${t.payment_type}`} value={t.planned_amount ? `LKR ${formatLkr(t.planned_amount)}` : t.planned_percentage ? `${t.planned_percentage}%` : 'Variable / measured'} />) : <Text style={styles.body}>Scheduled customer payment agreements naha. Me screen eka receipts record karanne naha.</Text>}<Pressable onPress={() => router.push({ pathname: '/(app)/project-planning', params: { projectId } })}><Text style={styles.link}>Plan payment terms</Text></Pressable></View>
    <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Variations</Text><Pressable onPress={() => router.push({ pathname: '/(app)/project-variations', params: { projectId } })}><Text style={styles.link}>Manage</Text></Pressable></View><Text style={styles.body}>{p.variations.length ? `${p.variations.length} variation request(s). Only internally approved adjustments affect the revised amount.` : 'Variation requests naha.'}</Text></View>
  </ScrollView></SafeAreaView>;
}
function Value({ label, value }: { label: string; value: string }) { return <View style={styles.value}><Text style={styles.valueLabel}>{label}</Text><Text style={styles.valueText}>{value}</Text></View>; }
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingBottom: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  back: { color: colors.green, fontWeight: '700', paddingVertical: 8 },
  ref: { color: colors.green, fontWeight: '800', fontSize: 10, letterSpacing: 1.2, marginTop: 24 },
  title: { color: colors.ink, fontSize: 29, lineHeight: 35, fontWeight: '800', marginTop: 7 },
  customer: { color: colors.ink, fontWeight: '700', fontSize: 16, marginTop: 14 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  meta: { flexDirection: 'row', gap: 9, marginTop: 15 },
  metaText: { color: colors.green, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, textTransform: 'capitalize', fontSize: 11 },
  quickNav: { flexDirection: 'row', gap: 12, marginTop: 18 },
  navCard: { flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  navIcon: { fontSize: 22, marginBottom: 4 },
  navTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  navSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  pnlCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, marginTop: 22, borderWidth: 1, borderColor: colors.line },
  pnlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pnlTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  pnlSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  metricItem: { flex: 1, backgroundColor: colors.canvas, padding: 12, borderRadius: radius.sm },
  metricLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 14, fontWeight: '800', color: colors.ink },
  costBreakdown: { backgroundColor: colors.canvas, padding: 12, borderRadius: radius.sm, marginBottom: 12 },
  costTitle: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  costLabel: { fontSize: 12, color: colors.muted },
  costVal: { fontSize: 12, fontWeight: '700', color: colors.ink },
  costTotalRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 6, paddingTop: 6 },
  costTotalLabel: { fontSize: 12, fontWeight: '800', color: colors.ink },
  costTotalVal: { fontSize: 12, fontWeight: '800', color: colors.ink },
  cashFlowBox: { backgroundColor: colors.canvas, padding: 12, borderRadius: radius.sm },
  section: { marginTop: 30, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontWeight: '800', fontSize: 18, marginBottom: 10 },
  value: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  valueLabel: { flex: 1, color: colors.muted, fontSize: 13 },
  valueText: { flex: 1, color: colors.ink, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginVertical: 8 },
  link: { color: colors.green, fontWeight: '800', fontSize: 12 },
});
