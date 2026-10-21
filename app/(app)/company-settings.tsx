import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, ChoiceGroup, ErrorNote, Field } from '@/components/ui';
import { updateOrganization, organizationInputSchema, type OrganizationInput } from '@/lib/organizations';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';
function SettingsForm({ organization }: { organization: NonNullable<ReturnType<typeof useOrganization>['organization']> }) {
  const { refresh } = useOrganization(); const [loading, setLoading] = useState(false); const [notice, setNotice] = useState('');
  const [form, setForm] = useState<OrganizationInput>({ name: organization.name, businessType: organization.business_type, phone: organization.phone ?? '', email: organization.email ?? '', address: organization.address ?? '', district: organization.district ?? '', registrationNumber: organization.registration_number ?? '', description: organization.description ?? '', preferredLanguage: organization.preferred_language });
  const update = <K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) => setForm(previous => ({ ...previous, [key]: value }));
  async function save() {
    if (loading) return; setNotice(''); const parsed = organizationInputSchema.safeParse(form);
    if (!parsed.success) { setNotice(parsed.error.issues[0]?.message ?? 'Details check karanna.'); return; }
    setLoading(true);
    try { await updateOrganization(organization.id, parsed.data); await refresh(); setNotice('Company details save una.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Save karanna bari una.'); }
    finally { setLoading(false); }
  }
  const canEdit = organization.role === 'owner' || organization.role === 'admin';
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.back} onPress={() => router.back()}>‹  Workspace</Text><Text style={styles.title}>Company settings</Text><Text style={styles.sub}>Company details update karanna. Owner/Admin ta witharai edit karanna puluwan.</Text>{notice ? <ErrorNote>{notice}</ErrorNote> : null}<Field label="Company name" editable={canEdit} value={form.name} onChangeText={v => update('name', v)} /><ChoiceGroup label="Business type" value={form.businessType} onChange={v => update('businessType', v)} options={[{ value: 'individual_contractor', label: 'Individual Contractor' }, { value: 'construction_company', label: 'Construction Company' }]} /><Field label="Contact phone" editable={canEdit} value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" /><Field label="Business email" editable={canEdit} value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" /><Field label="District" editable={canEdit} value={form.district} onChangeText={v => update('district', v)} /><Field label="Address" editable={canEdit} value={form.address} onChangeText={v => update('address', v)} /><Field label="Registration number" editable={canEdit} value={form.registrationNumber} onChangeText={v => update('registrationNumber', v)} /><Field label="Description" editable={canEdit} value={form.description} onChangeText={v => update('description', v)} multiline /><ChoiceGroup label="Preferred language" value={form.preferredLanguage} onChange={v => update('preferredLanguage', v)} options={[{ value: 'en', label: 'English' }, { value: 'si', label: 'Sinhala' }, { value: 'ta', label: 'Tamil' }]} />{canEdit ? <Button title="Save company details" loading={loading} onPress={save} /> : null}</ScrollView>;
}
export default function CompanySettingsScreen() {
  const { organization, loading } = useOrganization();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.green} />;
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{organization ? <SettingsForm key={organization.id} organization={organization} /> : <Text style={styles.sub}>Active company eka load wenne naha.</Text>}</KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { padding: space.lg, paddingTop: 28, paddingBottom: 44 }, back: { color: colors.green, fontWeight: '700', paddingVertical: 12 }, title: { color: colors.ink, fontWeight: '800', fontSize: 29, marginTop: 20 }, sub: { color: colors.muted, lineHeight: 21, marginTop: 8, marginBottom: 23 } });
