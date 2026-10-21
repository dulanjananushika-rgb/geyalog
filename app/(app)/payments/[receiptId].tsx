import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { getReceipt } from '@/lib/customer-payments';
import { listCompanyProjects } from '@/lib/project-management';
import { buildReceiptHtml } from '@/lib/receipt-pdf';
import { exportAndSharePdf, printDirect } from '@/lib/pdf-export';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const { organization } = useOrganization();
  const receipt = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'receipt', receiptId],
    enabled: Boolean(organization && receiptId),
    queryFn: () => getReceipt(organization!.id, receiptId),
  });
  const projects = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'projects', ''],
    enabled: Boolean(organization),
    queryFn: () => listCompanyProjects(organization!.id),
  });

  if (receipt.isLoading || projects.isLoading) return <ActivityIndicator style={{ flex: 1 }} color={colors.green} />;
  if (receipt.error || !receipt.data) {
    return (
      <SafeAreaView style={styles.page}>
        <Text style={styles.title}>Receipt unavailable</Text>
        <Text style={styles.sub}>Receipt eka load karanna bari una. Company access saha internet check karanna.</Text>
      </SafeAreaView>
    );
  }

  const item = receipt.data;
  const project = projects.data?.find(p => p.id === item.project_id);
  const amount = (() => {
    const [whole, decimal = ''] = item.amount.split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimal.padEnd(2, '0').slice(0, 2)}`;
  })();

  const generateHtml = () => {
    return buildReceiptHtml({
      company: organization?.name ?? 'GeyaLog',
      receiptNumber: item.receipt_number,
      projectRef: project?.project_reference ?? '—',
      projectName: project?.name ?? '—',
      customer: project?.customer_name ?? '—',
      amount: `LKR ${amount}`,
      method: item.payment_method.replaceAll('_', ' '),
      paymentDate: item.payment_date,
      reference: item.payment_reference ?? '',
      notes: item.notes ?? '',
      status: item.verification_status.replaceAll('_', ' ').toUpperCase(),
      issuedDate: new Date(item.created_at).toLocaleDateString(),
    });
  };

  const sharePdf = async () => {
    const html = generateHtml();
    await exportAndSharePdf(html, `Receipt-${item.receipt_number}`);
  };

  const printPdf = async () => {
    const html = generateHtml();
    await printDirect(html);
  };

  const shareText = async () => {
    try {
      await Share.share({
        message: `${organization?.name ?? 'GeyaLog'}\nPayment receipt acknowledgement\nReceipt: ${item.receipt_number}\nProject: ${project?.project_reference ?? '—'} · ${project?.name ?? '—'}\nCustomer: ${project?.customer_name ?? '—'}\nAmount received: LKR ${amount}\nMethod: ${item.payment_method.replaceAll('_', ' ')}\nDate: ${item.payment_date}\nReference: ${item.payment_reference ?? '—'}\nStatus: ${item.verification_status.replaceAll('_', ' ')}\nIssued: ${new Date(item.created_at).toLocaleString()}`,
        title: 'GeyaLog payment receipt',
      });
    } catch {
      Alert.alert('Share unavailable', 'Device sharing eka danata use karanna bari una.');
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.back} onPress={() => router.back()}>‹  Payments</Text>
        <Text style={styles.eyebrow}>PAYMENT RECEIPT · ACKNOWLEDGMENT</Text>
        <Text style={styles.receiptNo}>{item.receipt_number}</Text>
        <Text style={styles.company}>{organization?.name}</Text>
        <Text style={styles.amount}>LKR {amount}</Text>
        <Text style={styles.status}>{item.verification_status.replaceAll('_', ' ').toUpperCase()}</Text>
        <Text style={styles.notice}>
          Me document eka cash/payment receipt acknowledgement ekak. Invoice ekak nowe. Bank transfer/cheque cleared kiyala confirm karanne na.
        </Text>
        <Value label="Project" value={`${project?.project_reference ?? '—'} · ${project?.name ?? '—'}`} />
        <Value label="Customer" value={project?.customer_name ?? '—'} />
        <Value label="Payment method" value={item.payment_method.replaceAll('_', ' ')} />
        <Value label="Category" value={item.payment_category.replaceAll('_', ' ')} />
        <Value label="Payment date" value={item.payment_date} />
        <Value label="Payment reference" value={item.payment_reference ?? 'Not provided'} />
        <Value label="Notes" value={item.notes ?? '—'} />
        <Value label="Issued" value={new Date(item.created_at).toLocaleString()} />

        <View style={styles.buttonGroup}>
          <Button title="📄 Share PDF (WhatsApp / Save)" onPress={sharePdf} />
          <Button title="🖨️ Print Receipt" variant="outline" onPress={printPdf} />
          <Button title="💬 Share Text" variant="quiet" onPress={shareText} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.value}>
      <Text style={styles.label}>{label}{'\n'}</Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingTop: 26, paddingBottom: 44 },
  back: { color: colors.green, fontWeight: '700', paddingVertical: 10 },
  eyebrow: { color: colors.green, fontWeight: '800', letterSpacing: 1.2, fontSize: 10, marginTop: 25 },
  receiptNo: { color: colors.ink, fontWeight: '800', fontSize: 23, marginTop: 8 },
  company: { color: colors.muted, marginTop: 16 },
  amount: { color: colors.ink, fontSize: 34, fontWeight: '800', marginTop: 18, fontVariant: ['tabular-nums'] },
  status: { color: colors.green, fontSize: 11, fontWeight: '800', marginTop: 8 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 18, marginVertical: 17, padding: 12, backgroundColor: colors.mint },
  value: { color: colors.ink, fontWeight: '600', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { color: colors.muted, fontWeight: '500', fontSize: 11 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 8 },
  buttonGroup: { marginTop: 28, gap: 12 },
});
