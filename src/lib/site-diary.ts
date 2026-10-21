import { supabase } from './supabase';
import { siteDiarySchema, type SiteDiaryInput } from './site-diary-validation.ts';

export { siteDiarySchema, type SiteDiaryInput };

export type SiteDiaryEntry = {
  id: string;
  organization_id: string;
  project_id: string;
  diary_date: string;
  weather: 'sunny' | 'cloudy' | 'rainy' | 'heavy_rain' | 'windy';
  work_completed: string;
  issues_or_delays: string | null;
  workers_count: number;
  visitors: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

export async function recordSiteDiary(
  organizationId: string,
  projectId: string,
  input: SiteDiaryInput,
): Promise<SiteDiaryEntry> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const valid = siteDiarySchema.parse(input);

  const { data, error } = await supabase
    .from('site_diaries')
    .upsert(
      {
        organization_id: organizationId,
        project_id: projectId,
        diary_date: valid.diaryDate,
        weather: valid.weather,
        work_completed: valid.workCompleted,
        issues_or_delays: valid.issuesOrDelays || null,
        workers_count: valid.workersCount,
        visitors: valid.visitors || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,project_id,diary_date' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as SiteDiaryEntry;
}

export async function listSiteDiaries(
  organizationId: string,
  projectId: string,
): Promise<SiteDiaryEntry[]> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from('site_diaries')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('diary_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SiteDiaryEntry[];
}
