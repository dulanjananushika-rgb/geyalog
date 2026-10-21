import { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { createWorker } from '@/lib/workforce';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function NewWorkerScreen() {
  const { organization } = useOrganization(); const client = useQueryClient();
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState(''); const [skillCategory, setSkill] = useState('Mason'); const [engagementType, setType] = useState<'employee'|'daily_worker'|'subcontractor_individual'|'other'>('daily_worker'); const [notes, setNotes] = useState('');
  const mutation = useMutation({ mutationFn: () => createWorker(organization!.id, { fullName, phone, skillCategory, engagementType, notes }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['organization-scoped', organization?.id, 'workers'] }); Alert.alert('Worker saved', 'Worker record eka company directory ekata add kala.'); router.replace('/(app)/workforce'); } });
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>WORKER DIRECTORY</Text><SectionTitle title="Add worker" /><Text style={styles.body}>Profile eke wage rate save karanne naha. Rates project assignment ekata date ekka attach wenawa.</Text>
    <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Worker name" />
    <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="07X XXX XXXX" />
    <Field label="Skill category" value={skillCategory} onChangeText={setSkill} autoCapitalize="words" placeholder="Mason, Electrician..." />
    <ChoiceGroup label="Engagement type" value={engagementType} onChange={setType} options={[{value:'employee',label:'Employee'},{value:'daily_worker',label:'Daily worker'},{value:'subcontractor_individual',label:'Subcontractor'},{value:'other',label:'Other'}]} />
    <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Work-related notes" />
    {mutation.error ? <ErrorNote>{mutation.error instanceof Error ? mutation.error.message : 'Save karanna bari una.'}</ErrorNote> : null}
    <Button title="Save worker" loading={mutation.isPending} onPress={() => mutation.mutate()} />
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:colors.canvas},content:{padding:space.lg,paddingBottom:40},eyebrow:{fontSize:10,letterSpacing:1.5,color:colors.green,fontWeight:'800',marginBottom:10},body:{color:colors.muted,fontSize:14,lineHeight:21,marginTop:-5,marginBottom:22} });
