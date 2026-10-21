import { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { listProjects } from '@/lib/projects';
import { getHalfDayFactor, listWorkerAssignments, recordAttendance } from '@/lib/workforce';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const fractionFor = { present: '1', half_day: '0.5', absent: '0', approved_leave: '0', other: '1' } as const;
export default function AttendanceScreen() {
  const { organization } = useOrganization(); const client = useQueryClient();
  const projects = useQuery({ queryKey: ['organization-scoped', organization?.id, 'projects'], enabled: Boolean(organization), queryFn: () => listProjects(organization!.id) });
  const [projectId, setProjectId] = useState(''); const [assignmentId, setAssignmentId] = useState(''); const [workDate, setWorkDate] = useState(localDate()); const [status, setStatus] = useState<keyof typeof fractionFor>('present'); const [hours, setHours] = useState(''); const [notes, setNotes] = useState('');
  const projectList = projects.data ?? []; const selectedProjectId = projectList.some(x => x.id === projectId) ? projectId : projectList[0]?.id ?? '';
  const assignments = useQuery({ queryKey: ['organization-scoped', organization?.id, 'worker-assignments', selectedProjectId], enabled: Boolean(organization && selectedProjectId), queryFn: () => listWorkerAssignments(organization!.id, selectedProjectId) });
  const options = useMemo(() => (assignments.data ?? []).map(a => ({value:a.id,label:a.worker.full_name})), [assignments.data]);
  const selectedAssignment = assignments.data?.find(a => a.id === assignmentId) ?? assignments.data?.[0];
  const halfDay = useQuery({ queryKey: ['organization-scoped', organization?.id, 'worker-rate', selectedAssignment?.id, workDate], enabled: Boolean(organization && selectedAssignment && status === 'half_day'), queryFn: () => getHalfDayFactor(organization!.id, selectedAssignment!.id, workDate) });
  const dayFraction = status === 'half_day' ? (halfDay.data ?? '0') : fractionFor[status];
  const mutation = useMutation({ mutationFn: () => { if (!organization || !selectedAssignment) throw new Error('Project ekata active worker assignment ekak select karanna.'); return recordAttendance(organization.id, { workerAssignmentId: selectedAssignment.id, workerId: selectedAssignment.worker_id, projectId: selectedAssignment.project_id, workDate, attendanceStatus: status, dayFraction, hoursWorked: hours, notes }); }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['organization-scoped', organization?.id, 'attendance'] }); Alert.alert('Attendance submitted', 'Record eka review/approval status ekata save kala.'); setHours(''); setNotes(''); } });
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>SITE OPERATIONS</Text><SectionTitle title="Daily attendance" /><Text style={styles.body}>Submit kala record eka pending review. Attendance record ekak worker + assignment + date ekakata ekai.</Text>
    {projects.error ? <ErrorNote>{projects.error instanceof Error ? projects.error.message : 'Projects load karanna bari una.'}</ErrorNote> : null}
    <ChoiceGroup label="Project" value={selectedProjectId} onChange={setProjectId} options={projectList.map(p=>({value:p.id,label:p.name}))} />
    {assignments.error ? <ErrorNote>{assignments.error instanceof Error ? assignments.error.message : 'Assignments load karanna bari una.'}</ErrorNote> : null}
    <ChoiceGroup label="Worker" value={selectedAssignment?.id ?? ''} onChange={setAssignmentId} options={options} />
    <Field label="Work date (YYYY-MM-DD)" value={workDate} onChangeText={setWorkDate} placeholder="2026-10-11" />
    <ChoiceGroup label="Attendance" value={status} onChange={setStatus} options={[{value:'present',label:'Present'},{value:'half_day',label:'Half day'},{value:'absent',label:'Absent'},{value:'approved_leave',label:'Approved leave'},{value:'other',label:'Other'}]} />
    {status === 'half_day' ? <Text style={styles.body}>{halfDay.isLoading ? 'Configured half-day fraction load karanawa…' : halfDay.data === null ? 'Me date ekata valid rate agreement ekak naha. Attendance submit karanna kalin assignment rate configure karanna.' : `Company agreement anuwa half-day fraction: ${halfDay.data}`}</Text> : null}
    <Field label="Hours worked (optional)" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="e.g. 8" />
    <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Site note" />
    {mutation.error ? <ErrorNote>{mutation.error instanceof Error ? mutation.error.message : 'Attendance save karanna bari una.'}</ErrorNote> : null}
    <Button title="Submit attendance" loading={mutation.isPending} disabled={!selectedAssignment || (status === 'half_day' && (!halfDay.data || halfDay.isLoading || Boolean(halfDay.error)))} onPress={() => mutation.mutate()} />
    <Text style={styles.foot}>Duplicate date entry / daily hour limit database eka reject karanawa. Supervisor permissions backend RLS walin check wenawa.</Text>
    <Text onPress={() => router.back()} style={styles.back}>← Back to workers</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({page:{flex:1,backgroundColor:colors.canvas},content:{padding:space.lg,paddingBottom:40},eyebrow:{fontSize:10,letterSpacing:1.5,color:colors.green,fontWeight:'800',marginBottom:10},body:{color:colors.muted,fontSize:14,lineHeight:21,marginTop:-5,marginBottom:22},foot:{color:colors.muted,fontSize:12,lineHeight:19,marginTop:16},back:{color:colors.green,fontWeight:'700',paddingVertical:18}});
