import { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { getRequisition, listMaterials, reviewRequisition } from '@/lib/materials';
import { hasPermission } from '@/lib/permissions';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function RequisitionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { organization } = useOrganization();
  const org = organization?.id;
  const cache = useQueryClient();
  const canApprove = hasPermission(organization?.role, 'materials', 'approveOrders');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const request = useQuery({ queryKey: ['organization-scoped', org, 'material-requisition', id], enabled: Boolean(org && id), queryFn: () => getRequisition(org!, id!) });
  const materials = useQuery({ queryKey: ['organization-scoped', org, 'material-items'], enabled: Boolean(org), queryFn: () => listMaterials(org!) });
  const mutation = useMutation({
    mutationFn: () => reviewRequisition(id!, decision, decision === 'approved' ? request.data!.lines.map(line => ({ lineId: line.id, quantity: quantities[line.id] ?? line.approved_quantity ?? line.requested_quantity })) : []),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['organization-scoped', org, 'material-requisitions'] }); await cache.invalidateQueries({ queryKey: ['organization-scoped', org, 'material-requisition', id] }); Alert.alert(decision === 'approved' ? 'Request approved' : 'Request rejected', 'Decision eka database eke audit log ekath ekka save una.'); },
  });
  const materialNames = new Map((materials.data ?? []).map(item => [item.id, `${item.name} (${item.unit_name})`]));
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>MATERIAL REQUEST REVIEW</Text><SectionTitle title={request.data?.requisition.request_reference ?? 'Request details'} />
    {request.isLoading ? <ActivityIndicator color={colors.green} /> : null}
    {request.error ? <ErrorNote>{request.error instanceof Error ? request.error.message : 'Request load fail una.'}</ErrorNote> : null}
    {request.data ? <>
      <Text style={styles.body}>Status: {request.data.requisition.status.replaceAll('_', ' ')} · Needed by {request.data.requisition.needed_by ?? 'not set'}</Text>
      <Text style={styles.body}>{request.data.requisition.delivery_location ?? 'Delivery location not set'}</Text>
      {request.data.lines.map(line => <Text key={line.id} style={styles.line}>{materialNames.get(line.material_id) ?? 'Material'} · requested {line.requested_quantity}{line.approved_quantity ? ` · approved ${line.approved_quantity}` : ''}</Text>)}
      {canApprove && request.data.requisition.status === 'submitted' ? <>
        <SectionTitle eyebrow="DECISION" title="Review quantities" />
        <Text style={styles.body}>Approved quantities-tama future purchase order limit karanne. Request original quantity exceed karanna ba.</Text>
        {request.data.lines.map(line => <Field key={line.id} label={`Approve ${materialNames.get(line.material_id) ?? 'material'} (max ${line.requested_quantity})`} value={quantities[line.id] ?? ''} onChangeText={value => setQuantities(current => ({ ...current, [line.id]: value }))} keyboardType="decimal-pad" />)}
        <ChoiceGroup label="Decision" value={decision} onChange={value => setDecision(value as 'approved' | 'rejected')} options={[{ value: 'approved', label: 'Approve' }, { value: 'rejected', label: 'Reject' }]} />
        {mutation.error ? <ErrorNote>{mutation.error instanceof Error ? mutation.error.message : 'Review fail una.'}</ErrorNote> : null}
        <Button title={decision === 'approved' ? 'Approve request' : 'Reject request'} loading={mutation.isPending} onPress={() => mutation.mutate()} />
      </> : null}
      {!canApprove ? <Text style={styles.body}>Owner/Admin role ekakata request approve karanna puluwan.</Text> : null}
      {request.data.requisition.status === 'approved' ? <Button title="Create purchase order" variant="quiet" onPress={() => router.push('/(app)/materials/purchase-orders/new')} /> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingBottom: 40 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: colors.green, fontWeight: '800', marginBottom: 10 }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginVertical: 5 }, line: { color: colors.ink, fontSize: 14, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.line } });
