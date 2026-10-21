import { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, Field } from '@/components/ui';
import { listSiteDiaries, recordSiteDiary, type SiteDiaryInput } from '@/lib/site-diary';
import { getProjectOverview } from '@/lib/project-management';
import { useOrganization } from '@/providers/organization-provider';
import { colors, radius, space } from '@/theme/tokens';

const weatherOptions: { value: SiteDiaryInput['weather']; label: string }[] = [
  { value: 'sunny', label: '☀️ Sunny' },
  { value: 'cloudy', label: '⛅ Cloudy' },
  { value: 'rainy', label: '🌧️ Rainy' },
  { value: 'heavy_rain', label: '⛈️ Heavy Rain' },
  { value: 'windy', label: '💨 Windy' },
];

export default function SiteDiaryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { organization } = useOrganization();
  const cache = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState<SiteDiaryInput['weather']>('sunny');
  const [workCompleted, setWorkCompleted] = useState('');
  const [issuesOrDelays, setIssuesOrDelays] = useState('');
  const [workersCount, setWorkersCount] = useState('0');
  const [visitors, setVisitors] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const project = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'project', projectId],
    enabled: Boolean(organization && projectId),
    queryFn: () => getProjectOverview(organization!.id, projectId!),
  });

  const diaries = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'site-diaries', projectId],
    enabled: Boolean(organization && projectId),
    queryFn: () => listSiteDiaries(organization!.id, projectId!),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organization || !projectId) return;
      return recordSiteDiary(organization.id, projectId, {
        diaryDate: date,
        weather,
        workCompleted,
        issuesOrDelays,
        workersCount: Number(workersCount) || 0,
        visitors,
      });
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['organization-scoped', organization?.id, 'site-diaries', projectId] });
      setShowAddForm(false);
      setWorkCompleted('');
      setIssuesOrDelays('');
      setVisitors('');
      Alert.alert('Saved', 'Daily site diary entry recorded successfully.');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Diary entry save karanna bari una.');
    },
  });

  const weatherIcons: Record<string, string> = {
    sunny: '☀️',
    cloudy: '⛅',
    rainy: '🌧️',
    heavy_rain: '⛈️',
    windy: '💨',
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.back} onPress={() => router.back()}>‹  Project</Text>
        <Text style={styles.eyebrow}>SITE LOGBOOK</Text>
        <Text style={styles.title}>Daily Site Diary</Text>
        <Text style={styles.sub}>{project.data?.name ?? 'Project'} · {project.data?.project_reference}</Text>

        {!showAddForm ? (
          <View style={styles.actionRow}>
            <Button title="✍️ Record Today's Diary" onPress={() => setShowAddForm(true)} />
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Record Site Diary</Text>
            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <ChoiceGroup label="Weather Conditions" options={weatherOptions} value={weather} onChange={setWeather} />
            <Field
              label="Work Completed Today *"
              value={workCompleted}
              onChangeText={setWorkCompleted}
              multiline
              placeholder="e.g. Ground floor column concrete poured (columns 1 to 6). Rebar tied for beam 3."
            />
            <Field
              label="Issues / Weather Delays"
              value={issuesOrDelays}
              onChangeText={setIssuesOrDelays}
              multiline
              placeholder="e.g. Heavy rain from 2 PM to 4 PM stopped outdoor plastering."
            />
            <Field
              label="Number of Workers on Site"
              value={workersCount}
              onChangeText={setWorkersCount}
              keyboardType="number-pad"
              placeholder="e.g. 8"
            />
            <Field
              label="Site Visitors / Inspections"
              value={visitors}
              onChangeText={setVisitors}
              placeholder="e.g. Client inspected plumbing fittings."
            />
            <View style={styles.formButtons}>
              <Button title="Save Diary Entry" loading={mutation.isPending} onPress={() => mutation.mutate()} />
              <Button title="Cancel" variant="quiet" onPress={() => setShowAddForm(false)} />
            </View>
          </View>
        )}

        <Text style={styles.historyTitle}>Past Diary Entries</Text>
        {diaries.isLoading ? <ActivityIndicator color={colors.green} /> : null}
        {diaries.data?.length === 0 ? (
          <Text style={styles.empty}>Thama me project ekata site diary entries record karala naha.</Text>
        ) : null}

        {diaries.data?.map((item) => (
          <View key={item.id} style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <Text style={styles.diaryDate}>{item.diary_date}</Text>
              <Text style={styles.diaryWeather}>
                {weatherIcons[item.weather] ?? '☀️'} {item.weather.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.diaryWorkers}>👷 Workers on site: {item.workers_count}</Text>
            <Text style={styles.diarySection}>Work Done:</Text>
            <Text style={styles.diaryText}>{item.work_completed}</Text>
            {item.issues_or_delays ? (
              <>
                <Text style={[styles.diarySection, { color: colors.red }]}>⚠️ Delays / Notes:</Text>
                <Text style={styles.diaryText}>{item.issues_or_delays}</Text>
              </>
            ) : null}
            {item.visitors ? (
              <>
                <Text style={styles.diarySection}>👤 Visitors:</Text>
                <Text style={styles.diaryText}>{item.visitors}</Text>
              </>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingTop: 26, paddingBottom: 50 },
  back: { color: colors.green, fontWeight: '700', paddingVertical: 8 },
  eyebrow: { color: colors.green, fontWeight: '800', letterSpacing: 1.2, fontSize: 10, marginTop: 15 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 4 },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 20 },
  actionRow: { marginBottom: 24 },
  formCard: {
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 28,
  },
  formTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 16 },
  formButtons: { marginTop: 16, gap: 10 },
  historyTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  empty: { color: colors.muted, fontStyle: 'italic', marginTop: 10 },
  diaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: 14,
  },
  diaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  diaryDate: { fontSize: 17, fontWeight: '800', color: colors.ink },
  diaryWeather: { fontSize: 12, fontWeight: '700', color: colors.green, backgroundColor: colors.mint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  diaryWorkers: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 10 },
  diarySection: { fontSize: 12, fontWeight: '800', color: colors.muted, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  diaryText: { fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: 3 },
});
