import { useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChoiceGroup, ErrorNote, SectionTitle } from '@/components/ui';
import { hasPermission } from '@/lib/permissions';
import { getLabourProjectSummary, getWorkerFinancialHistory, listWorkers } from '@/lib/workforce';
import { listProjects } from '@/lib/projects';
import { useOrganization } from '@/providers/organization-provider';
import { colors, space } from '@/theme/tokens';

export default function LabourReporting(){
 const {organization}=useOrganization();const org=organization?.id;const allowed=hasPermission(organization?.role,'labour','wagesRead');const [projectId,setProject]=useState(''),[workerId,setWorker]=useState('');
 const projects=useQuery({queryKey:['organization-scoped',org,'projects'],enabled:Boolean(org&&allowed),queryFn:()=>listProjects(org!)});const workers=useQuery({queryKey:['organization-scoped',org,'workers'],enabled:Boolean(org&&allowed),queryFn:()=>listWorkers(org!)});
 const project=(projects.data??[]).find(p=>p.id===projectId)??projects.data?.[0];const worker=(workers.data??[]).find(w=>w.id===workerId)??workers.data?.[0];
 const summary=useQuery({queryKey:['organization-scoped',org,'labour-cost-summary',project?.id],enabled:Boolean(org&&allowed&&project),queryFn:()=>getLabourProjectSummary(org!,project!.id)});const history=useQuery({queryKey:['organization-scoped',org,'worker-history',worker?.id],enabled:Boolean(org&&allowed&&worker),queryFn:()=>getWorkerFinancialHistory(org!,worker!.id)});
 return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>PRIVATE LABOUR FINANCE</Text><SectionTitle title="Labour cost & history"/><Text style={styles.body}>Earned work, actual confirmed payments saha worker advances wen wenama pennanawa. Me summary eka company finance roles walata witharai.</Text>
 {!allowed?<ErrorNote>Owner/Admin/Accountant role ekakata wage reports balanna puluwan.</ErrorNote>:<>
 <SectionTitle eyebrow="PROJECT SUMMARY" title="Labour balances"/><ChoiceGroup label="Project" value={project?.id??''} onChange={setProject} options={(projects.data??[]).map(p=>({value:p.id,label:p.name}))}/>{summary.isLoading?<ActivityIndicator color={colors.green}/>:null}{summary.error?<ErrorNote>{summary.error instanceof Error?summary.error.message:'Labour summary load una naha.'}</ErrorNote>:null}{summary.data?<View style={styles.summary}>
   <Amount label="Earned labour cost" hint="Approved worker earnings + subcontractor work" value={summary.data.earned_labour_cost}/>
   <Amount label="Confirmed payment outflow" hint="Confirmed labour payments; advances listed separately" value={summary.data.confirmed_payment_outflow}/>
   <Amount label="Pending verification payments" hint="Cheque / bank / other pending records" value={summary.data.pending_payment_amount}/>
   <Amount label="Confirmed worker advances" hint="Cash advances paid; not counted as wage cost" value={summary.data.confirmed_advance_outflow}/>
   <Amount label="Unrecovered advances" hint="Confirmed advances less authorized offsets" value={summary.data.unrecovered_advances}/>
   <Amount label="Subcontractor advances outstanding" hint="Confirmed advances without a work allocation in this phase" value={summary.data.subcontractor_advances_outstanding}/>
   <Amount label="Earned balance payable" hint="Earned cost less confirmed settlement and applied offsets" value={summary.data.earned_balance_payable}/>
 </View>:null}
 <SectionTitle eyebrow="WORKER LEDGER" title="Payment history"/><ChoiceGroup label="Worker" value={worker?.id??''} onChange={setWorker} options={(workers.data??[]).map(w=>({value:w.id,label:`${w.full_name} · ${w.skill_category}`}))}/>{history.isLoading?<ActivityIndicator color={colors.green}/>:null}{history.error?<ErrorNote>{history.error instanceof Error?history.error.message:'Worker history load una naha.'}</ErrorNote>:null}{!history.isLoading&&!history.error&&!history.data?.length?<Text style={styles.body}>Me worker ta labour history records thama naha.</Text>:null}
 {history.data?.map((row,index)=><View key={`${row.record_type}-${row.record_date}-${index}`} style={styles.row}><View style={{flex:1}}><Text style={styles.title}>{row.record_type.replaceAll('_',' ').toUpperCase()} · {row.status.replaceAll('_',' ')}</Text><Text style={styles.body}>{row.record_date} · {row.details}</Text></View>{row.amount!==null?<Text style={styles.amount}>LKR {row.amount}</Text>:null}</View>)}
 </>}
 </ScrollView></SafeAreaView>;
}
function Amount({label,hint,value}:{label:string;hint:string;value:string}){return <View style={styles.amountRow}><View style={{flex:1}}><Text style={styles.title}>{label}</Text><Text style={styles.hint}>{hint}</Text></View><Text style={styles.amount}>LKR {value}</Text></View>;}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.canvas},content:{padding:space.lg,paddingBottom:40},eyebrow:{fontSize:10,letterSpacing:1.5,color:colors.green,fontWeight:'800',marginBottom:10},body:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:4,marginBottom:8},summary:{borderTopWidth:1,borderColor:colors.line,marginTop:8},amountRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderColor:colors.line},title:{color:colors.ink,fontSize:14,fontWeight:'700'},hint:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:3},amount:{color:colors.ink,fontSize:14,fontWeight:'800',fontVariant:['tabular-nums']},row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderTopWidth:1,borderColor:colors.line}});
