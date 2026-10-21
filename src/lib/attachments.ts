import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from './supabase';

export type Attachment = {
  id: string;
  organization_id: string;
  project_id: string | null;
  entity_type: 'project' | 'site_diary' | 'receipt' | 'goods_receipt' | 'worker' | 'material' | 'general';
  entity_id: string | null;
  file_url: string;
  file_name: string | null;
  caption: string | null;
  created_at: string;
};

export async function pickImageFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Camera eka use karanna permission onawenawa.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function pickImageFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Photos access karanna permission onawenawa.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function saveAttachment(input: {
  organizationId: string;
  projectId?: string | null;
  entityType: Attachment['entity_type'];
  entityId?: string | null;
  fileUrl: string;
  fileName?: string | null;
  caption?: string | null;
}) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase
    .from('attachments')
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId || null,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      file_url: input.fileUrl,
      file_name: input.fileName || null,
      caption: input.caption || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Attachment;
}

export async function listAttachments(organizationId: string, filter?: {
  projectId?: string;
  entityType?: Attachment['entity_type'];
  entityId?: string;
}): Promise<Attachment[]> {
  if (!supabase) throw new Error('Supabase client not initialized');
  let query = supabase
    .from('attachments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filter?.projectId) query = query.eq('project_id', filter.projectId);
  if (filter?.entityType) query = query.eq('entity_type', filter.entityType);
  if (filter?.entityId) query = query.eq('entity_id', filter.entityId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Attachment[];
}
