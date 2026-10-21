import { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { listProjects } from '@/lib/projects';
import { approveAttendance, listAttendance } from '@/lib/workforce';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

function dateToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export default function AttendanceReviewScreen(){
  const {organization}=useOrganization(); const cache=useQueryClient(); const [projectId,setProjectId]=useState('');const [workDate,setWorkDate]=useState(dateToday());
  const projects=useQuery({queryKey:['organization-scoped',organization?.id,'projects'],enabled:Boolean(organization),queryFn:()=>listProjects(organization!.id)});
  const chosen=(projects.data??[]).some(p=>p.id===projectId)?projectId:projects.data?.[0]?.id??'';
  const records=useQuery({queryKey:['organization-scoped',organization?.id,'attendance',chosen,workDate],enabled:Boolean(organization&&chosen),queryFn:()=>listAttendance(organization!.id,chosen,workDate)});
  const approval=useMutation({mutationFn:(id:string)=>approveAttendance(id),onSuccess:async()=>{await cache.invalidateQueries({queryKey:['organization-scoped',organization?.id,'attendance',chosen,workDate]});Alert.alert('Attendance approved','Approved attendance ekata wage entry eka transaction ekak athule haduna.');}});
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>REVIEW & EARNINGS</Text><SectionTitle title="Attendance review"/><Text style={styles.body}>Owner/Admin kenek approve karaddi applicable dated rate eken earning entry eka same database transaction ekedi generate wenawa.</Text>
    {projects.error?<ErrorNote>{projects.error instanceof Error?projects.error.message:'Projects load una naha.'}</ErrorNote>:null}
    <ChoiceGroup label="Project" value={chosen} onChange={setProjectId} options={(projects.data??[]).map(p=>({value:p.id,label:p.name}))}/>
    <Field label="Work date (YYYY-MM-DD)" value={workDate} onChangeText={setWorkDate} placeholder="2026-10-11"/>
    {records.isLoading?<ActivityIndicator color={colors.green}/>:null}{records.error?<ErrorNote>{records.error instanceof Error?records.error.message:'Attendance load karanna bari una.'}</ErrorNote>:null}
    {!records.isLoading&&!records.error&&!records.data?.length?<View style={styles.empty}><Text style={styles.title}>Attendance records naha</Text><Text style={styles.body}>Me project/date ekata records thama submit wela naha.</Text></View>:null}
    {records.data?.map(row=><View key={row.id} style={styles.row}><View style={{flex:1}}><Text style={styles.title}>{row.worker?.full_name??'Worker'}</Text><Text style={styles.body}>{row.attendance_status.replaceAll('_',' ')} · {row.hours_worked??'hours n/a'} h · {row.approval_status}</Text>{row.notes?<Text style={styles.body}>{row.notes}</Text>:null}</View>{row.approval_status==='pending'?<Button title="Approve" loading={approval.isPending} onPress={()=>approval.mutate(row.id)}/>:null}</View>)}
    {approval.error?<ErrorNote>{approval.error instanceof Error?approval.error.message:'Approve karanna bari una.'}</ErrorNote>:null}
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.canvas},content:{padding:space.lg,paddingBottom:40},eyebrow:{fontSize:10,letterSpacing:1.5,color:colors.green,fontWeight:'800',marginBottom:10},body:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:5},empty:{paddingVertical:22,borderTopWidth:1,borderColor:colors.line},title:{color:colors.ink,fontWeight:'700',fontSize:15},row:{paddingVertical:16,borderTopWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:10}});
