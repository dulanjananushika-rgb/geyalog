import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Brand, Button, ChoiceGroup, ErrorNote, Field } from '@/components/ui';
import { createOrganization, organizationInputSchema, type OrganizationInput } from '@/lib/organizations';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function SetupCompanyScreen() {
  const { refresh } = useOrganization(); const [step, setStep] = useState(1); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState<OrganizationInput>({ name: '', businessType: 'individual_contractor', phone: '', email: '', address: '', district: '', registrationNumber: '', description: '', preferredLanguage: 'en' });
  const update = <K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) => setForm(previous => ({ ...previous, [key]: value }));
  async function submit() {
    if (loading) return; setError(''); const parsed = organizationInputSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Details check karanna.'); setStep(1); return; }
    setLoading(true);
    try { await createOrganization(parsed.data); await refresh(); router.replace('/(app)'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Company create karanna bari una.'); }
    finally { setLoading(false); }
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Brand /><Text style={styles.kicker}>STEP {step} OF 2</Text><Text style={styles.heading}>{step === 1 ? 'Oyāge business eka' : 'Contact details'}</Text><Text style={styles.sub}>Simple widihata start karanna. Company registration number eka optional.</Text>{error ? <ErrorNote>{error}</ErrorNote> : null}
    {step === 1 ? <><Field label="Company / business name *" placeholder="e.g. Perera Construction" value={form.name} onChangeText={v => update('name', v)} /><ChoiceGroup label="Business type" value={form.businessType} onChange={v => update('businessType', v)} options={[{ value: 'individual_contractor', label: 'Individual Contractor' }, { value: 'construction_company', label: 'Construction Company' }]} /><ChoiceGroup label="Preferred language" value={form.preferredLanguage} onChange={v => update('preferredLanguage', v)} options={[{ value: 'en', label: 'English' }, { value: 'si', label: 'Sinhala' }, { value: 'ta', label: 'Tamil' }]} /><Button title="Continue" onPress={() => { const parsed = organizationInputSchema.shape.name.safeParse(form.name); if (!parsed.success) { setError('Company name eka characters 2-120 athara denna.'); return; } setError(''); setStep(2); }} /></> : <><Field label="Contact phone" placeholder="07X XXX XXXX" value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" /><Field label="Business email (optional)" placeholder="company@example.com" value={form.email} onChangeText={v => update('email', v)} keyboardType="email-address" autoCapitalize="none" /><Field label="District" placeholder="e.g. Gampaha" value={form.district} onChangeText={v => update('district', v)} /><Field label="Address (optional)" placeholder="Business address" value={form.address} onChangeText={v => update('address', v)} /><Field label="Registration number (optional)" placeholder="If registered" value={form.registrationNumber} onChangeText={v => update('registrationNumber', v)} /><Field label="Description (optional)" placeholder="Short business description" value={form.description} onChangeText={v => update('description', v)} multiline /><Button title="Create company workspace" onPress={submit} loading={loading} /><Text style={styles.back} onPress={() => { setError(''); setStep(1); }}>‹  Back</Text></>}
  </ScrollView></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas }, content: { flexGrow: 1, padding: space.lg, paddingTop: 28 }, kicker: { color: colors.green, fontWeight: '800', letterSpacing: 1.5, fontSize: 10, marginTop: 34 }, heading: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 7 }, sub: { color: colors.muted, lineHeight: 21, marginTop: 8, marginBottom: 24 }, back: { textAlign: 'center', color: colors.green, padding: 18, fontWeight: '700' } });
