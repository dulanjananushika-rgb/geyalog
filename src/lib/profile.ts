import { supabase } from '@/lib/supabase';
import type { ProfileInput } from '@/lib/auth-validation';

export type PreferredLanguage = ProfileInput['preferredLanguage'];
export type Profile = {
  id: string;
  full_name: string;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
};

export async function getMyProfile(userId: string): Promise<Profile> {
  if (!supabase) throw new Error('Supabase setup eka complete karala app eka restart karanna.');
  const { data, error } = await supabase.from('profiles').select('id,full_name,preferred_language,created_at,updated_at').eq('id', userId).single();
  if (error) throw new Error(error.code === 'PGRST116'
    ? 'Profile record eka hambune naha. Migration eka Supabase ekata apply karala balanna.'
    : 'Profile eka load karanna bari una. Internet saha Supabase setup eka check karanna.');
  return data as Profile;
}

export async function updateMyProfile(userId: string, input: ProfileInput): Promise<Profile> {
  if (!supabase) throw new Error('Supabase setup eka complete karala app eka restart karanna.');
  const { data, error } = await supabase.from('profiles')
    .update({ full_name: input.fullName.trim(), preferred_language: input.preferredLanguage })
    .eq('id', userId)
    .select('id,full_name,preferred_language,created_at,updated_at')
    .single();
  if (error) throw new Error('Profile eka save karanna bari una. Internet saha Supabase migration eka check karanna.');
  return data as Profile;
}
