import { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { hasPermission } from '@/lib/permissions';
import {
  approveLabourSettlement, confirmLabourAdvance, confirmLabourPayment, createLabourSettlement,
  listLabourAdvances, listLabourPayments, listLabourSettlements, listWorkerAssignments,
  recordLabourAdvance, recordLabourSettlementPayment,
} from '@/lib/workforce';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LabourPayments() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const canPay = hasPermission(organization?.role, 'labour', 'wagesWrite');
  const cache = useQueryClient();
  const [assignmentId, setAssignmentId] = useState('');
  const [draftSettlementId, setDraftSettlementId] = useState('');
  const [settlementId, setSettlementId] = useState('');
  const [advanceId, setAdvanceId] = useState('');
  const [advanceOffset, setAdvanceOffset] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState(today());
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [notes, setNotes] = useState('');

  const assignments = useQuery({
    queryKey: ['organization-scoped', organizationId, 'worker-assignments'],
    enabled: Boolean(organizationId && canPay),
    queryFn: () => listWorkerAssignments(organizationId!),
  });
  const advances = useQuery({
    queryKey: ['organization-scoped', organizationId, 'labour-advances'],
    enabled: Boolean(organizationId && canPay),
    queryFn: () => listLabourAdvances(organizationId!),
  });
  const settlements = useQuery({
    queryKey: ['organization-scoped', organizationId, 'labour-settlements'],
    enabled: Boolean(organizationId && canPay),
    queryFn: () => listLabourSettlements(organizationId!),
  });
  const payments = useQuery({
    queryKey: ['organization-scoped', organizationId, 'labour-payments'],
    enabled: Boolean(organizationId && canPay),
    queryFn: () => listLabourPayments(organizationId!),
  });

  const assignment = assignments.data?.find(row => row.id === assignmentId) ?? assignments.data?.[0];
  const drafts = (settlements.data ?? []).filter(row => row.status === 'draft');
  const draft = drafts.find(row => row.id === draftSettlementId) ?? drafts[0];
  const confirmedAdvances = (advances.data ?? []).filter(row => row.status === 'confirmed' && row.worker_id === draft?.worker_id && row.project_id === draft?.project_id);
  const advance = confirmedAdvances.find(row => row.id === advanceId);
  const payableSettlements = (settlements.data ?? []).filter(row => ['approved', 'partially_paid'].includes(row.status));
  const payable = payableSettlements.find(row => row.id === settlementId) ?? payableSettlements[0];

  const refresh = async () => {
    await Promise.all(['labour-advances', 'labour-settlements', 'labour-payments'].map(key =>
      cache.invalidateQueries({ queryKey: ['organization-scoped', organizationId, key] }),
    ));
  };
  const advanceMutation = useMutation({
    mutationFn: () => recordLabourAdvance(organizationId!, {
      projectId: assignment!.project_id, workerId: assignment!.worker_id, assignmentId: assignment!.id,
      amount, paymentDate, method, notes,
    }),
    onSuccess: async () => { await refresh(); setAmount(''); Alert.alert('Advance saved', method === 'cash' ? 'Cash advance eka confirmed.' : 'Payment verification pending.'); },
  });
  const settlementMutation = useMutation({
    mutationFn: () => createLabourSettlement(organizationId!, { assignmentId: assignment!.id, startDate: periodStart, endDate: periodEnd }),
    onSuccess: async id => { await refresh(); setDraftSettlementId(id); Alert.alert('Settlement drafted', 'Approved attendance/task earnings adala period ekata gather kala.'); },
  });
  const approveMutation = useMutation({
    mutationFn: () => approveLabourSettlement(draft!.id, advance && advanceOffset ? [{ advanceId: advance.id, amount: advanceOffset }] : []),
    onSuccess: async () => { await refresh(); setAdvanceOffset(''); setAdvanceId(''); },
  });
  const paymentMutation = useMutation({
    mutationFn: () => recordLabourSettlementPayment({ settlementId: payable!.id, amount, paymentDate, method, notes }),
    onSuccess: async () => { await refresh(); setAmount(''); Alert.alert('Payment saved', method === 'cash' ? 'Payment confirmed.' : 'Verification pending.'); },
  });
  const confirmPayment = useMutation({ mutationFn: confirmLabourPayment, onSuccess: refresh });
  const confirmAdvance = useMutation({ mutationFn: confirmLabourAdvance, onSuccess: refresh });
  const actionError = [advanceMutation.error, settlementMutation.error, approveMutation.error, paymentMutation.error, confirmPayment.error, confirmAdvance.error].find(Boolean);

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>LABOUR FINANCE</Text>
      <SectionTitle title="Advances & wages" />
      <Text style={styles.body}>Earned wages, advances saha actual payments separately track wenawa. Supervisor kenekta confidential wage details access naha.</Text>
      {!canPay ? <ErrorNote>Accountant/Owner/Admin role ekakata wage records balanna puluwan.</ErrorNote> : null}
      {canPay ? <>
        {assignments.isLoading ? <ActivityIndicator color={colors.green} /> : null}
        {assignments.error ? <ErrorNote>{assignments.error instanceof Error ? assignments.error.message : 'Assignments load una naha.'}</ErrorNote> : null}
        <SectionTitle eyebrow="ADVANCE" title="Record worker advance" />
        <ChoiceGroup label="Project worker" value={assignment?.id ?? ''} onChange={setAssignmentId} options={(assignments.data ?? []).map(row => ({ value: row.id, label: `${row.worker.full_name} · ${row.project.name}` }))} />
        <Field label="Amount (LKR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Payment date (YYYY-MM-DD)" value={paymentDate} onChangeText={setPaymentDate} />
        <ChoiceGroup label="Method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }]} />
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
        <Button title="Record advance" loading={advanceMutation.isPending} disabled={!assignment || !amount} onPress={() => advanceMutation.mutate()} />

        <SectionTitle eyebrow="SETTLEMENT PERIOD" title="Calculate wages" />
        <ChoiceGroup label="Worker assignment" value={assignment?.id ?? ''} onChange={setAssignmentId} options={(assignments.data ?? []).map(row => ({ value: row.id, label: `${row.worker.full_name} · ${row.project.name}` }))} />
        <Field label="Period start" value={periodStart} onChangeText={setPeriodStart} />
        <Field label="Period end" value={periodEnd} onChangeText={setPeriodEnd} />
        <Button title="Create draft settlement" variant="quiet" loading={settlementMutation.isPending} disabled={!assignment} onPress={() => settlementMutation.mutate()} />

        <SectionTitle eyebrow="ADVANCE OFFSET" title="Review draft" />
        {drafts.length ? <>
          <ChoiceGroup label="Draft settlement" value={draft?.id ?? ''} onChange={setDraftSettlementId} options={drafts.map(row => ({ value: row.id, label: `${assignments.data?.find(a => a.id === row.assignment_id)?.worker.full_name ?? 'Worker'} · ${row.period_start}–${row.period_end} · LKR ${row.gross_earned}` }))} />
          {confirmedAdvances.length ? <>
            <ChoiceGroup label="Recover confirmed advance (optional)" value={advance?.id ?? ''} onChange={setAdvanceId} options={[{ value: '', label: 'No offset' }, ...confirmedAdvances.map(row => ({ value: row.id, label: `LKR ${row.amount} · ${row.payment_date}` }))]} />
            {advance ? <Field label="Amount to recover (LKR)" value={advanceOffset} onChangeText={setAdvanceOffset} keyboardType="decimal-pad" /> : null}
          </> : null}
          <Button title="Approve settlement" loading={approveMutation.isPending} disabled={!draft || (Boolean(advance) && !advanceOffset)} onPress={() => approveMutation.mutate()} />
        </> : <Text style={styles.body}>Draft wage settlements naha.</Text>}

        {payableSettlements.length ? <>
          <SectionTitle eyebrow="SETTLEMENT PAYMENT" title="Record payment" />
          <ChoiceGroup label="Approved settlement" value={payable?.id ?? ''} onChange={setSettlementId} options={payableSettlements.map(row => ({ value: row.id, label: `${assignments.data?.find(a => a.id === row.assignment_id)?.worker.full_name ?? 'Worker'} · ${row.period_start}–${row.period_end} · ${row.status}` }))} />
          <Text style={styles.body}>Gross LKR {payable?.gross_earned}; recovered advance LKR {payable?.advance_offset}. Amount due backend eken verify karanawa.</Text>
          <Field label="Payment amount (LKR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <ChoiceGroup label="Method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }]} />
          <Button title="Record wage payment" loading={paymentMutation.isPending} disabled={!payable || !amount} onPress={() => paymentMutation.mutate()} />
        </> : null}

        <SectionTitle eyebrow="HISTORY" title="Advances & payments" />
        {advances.data?.map(row => <View key={row.id} style={styles.row}><View style={styles.grow}><Text style={styles.title}>Advance · LKR {row.amount} · {row.status.replaceAll('_', ' ')}</Text><Text style={styles.body}>{row.payment_date} · {row.payment_method}</Text></View>{row.status === 'pending_verification' ? <Button title="Confirm" loading={confirmAdvance.isPending} onPress={() => confirmAdvance.mutate(row.id)} /> : null}</View>)}
        {payments.data?.map(row => <View key={row.id} style={styles.row}><View style={styles.grow}><Text style={styles.title}>LKR {row.payment_amount} · {row.status.replaceAll('_', ' ')}</Text><Text style={styles.body}>{row.payment_date} · {row.payment_purpose.replaceAll('_', ' ')}</Text></View>{row.status === 'pending_verification' ? <Button title="Confirm" loading={confirmPayment.isPending} onPress={() => confirmPayment.mutate(row.id)} /> : null}</View>)}
      </> : null}
      {actionError ? <ErrorNote>{actionError instanceof Error ? actionError.message : 'Labour finance action eka complete une naha.'}</ErrorNote> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingBottom: 42 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: colors.green, fontWeight: '800', marginBottom: 10 }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, title: { fontSize: 14, fontWeight: '700', color: colors.ink }, row: { paddingVertical: 14, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10 }, grow: { flex: 1 } });
