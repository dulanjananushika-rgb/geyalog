import { useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ChoiceGroup, Field } from '@/components/ui';
import { listAttachments, pickImageFromCamera, pickImageFromLibrary, saveAttachment, type Attachment } from '@/lib/attachments';
import { getProjectOverview } from '@/lib/project-management';
import { useOrganization } from '@/providers/organization-provider';
import { colors, radius, space } from '@/theme/tokens';

const typeOptions: { value: Attachment['entity_type']; label: string }[] = [
  { value: 'project', label: '📸 Site Progress' },
  { value: 'goods_receipt', label: '📦 Delivery Note' },
  { value: 'receipt', label: '💳 Payment Slip' },
  { value: 'material', label: '🧱 Material / Bill' },
];

export default function ProjectAttachmentsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { organization } = useOrganization();
  const cache = useQueryClient();

  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [entityType, setEntityType] = useState<Attachment['entity_type']>('project');

  const project = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'project', projectId],
    enabled: Boolean(organization && projectId),
    queryFn: () => getProjectOverview(organization!.id, projectId!),
  });

  const attachments = useQuery({
    queryKey: ['organization-scoped', organization?.id, 'attachments', projectId],
    enabled: Boolean(organization && projectId),
    queryFn: () => listAttachments(organization!.id, { projectId }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization || !projectId || !selectedUri) return;
      return saveAttachment({
        organizationId: organization.id,
        projectId,
        entityType,
        fileUrl: selectedUri,
        caption: caption || null,
      });
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['organization-scoped', organization?.id, 'attachments', projectId] });
      setSelectedUri(null);
      setCaption('');
      Alert.alert('Saved', 'Photo / document uploaded successfully.');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Photo save karanna bari una.');
    },
  });

  const handleCamera = async () => {
    const uri = await pickImageFromCamera();
    if (uri) setSelectedUri(uri);
  };

  const handleGallery = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) setSelectedUri(uri);
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.back} onPress={() => router.back()}>‹  Project</Text>
        <Text style={styles.eyebrow}>SITE MEDIA & DOCUMENTS</Text>
        <Text style={styles.title}>Photos & Attachments</Text>
        <Text style={styles.sub}>{project.data?.name ?? 'Project'} · {project.data?.project_reference}</Text>

        {!selectedUri ? (
          <View style={styles.actionRow}>
            <Button title="📷 Take Photo (Camera)" onPress={handleCamera} />
            <Button title="🖼️ Pick from Gallery" variant="quiet" onPress={handleGallery} />
          </View>
        ) : (
          <View style={styles.uploadCard}>
            <Text style={styles.uploadTitle}>Confirm & Save Photo</Text>
            <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" />
            <ChoiceGroup label="Photo Category" options={typeOptions} value={entityType} onChange={setEntityType} />
            <Field
              label="Caption / Description"
              value={caption}
              onChangeText={setCaption}
              placeholder="e.g. Foundation beam concrete pouring at site entrance"
            />
            <View style={styles.uploadButtons}>
              <Button title="Upload & Save" loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} />
              <Button title="Discard" variant="quiet" onPress={() => setSelectedUri(null)} />
            </View>
          </View>
        )}

        <Text style={styles.galleryTitle}>Project Gallery ({attachments.data?.length ?? 0})</Text>
        {attachments.isLoading ? <ActivityIndicator color={colors.green} /> : null}
        {attachments.data?.length === 0 ? (
          <Text style={styles.empty}>Me project ekata thama photos upload karala naha.</Text>
        ) : null}

        <View style={styles.grid}>
          {attachments.data?.map((item) => (
            <View key={item.id} style={styles.gridCard}>
              <Image source={{ uri: item.file_url }} style={styles.gridImage} resizeMode="cover" />
              <View style={styles.gridDetails}>
                <Text style={styles.gridBadge}>{item.entity_type.replaceAll('_', ' ').toUpperCase()}</Text>
                {item.caption ? <Text style={styles.gridCaption}>{item.caption}</Text> : null}
                <Text style={styles.gridDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </View>
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
  actionRow: { gap: 10, marginBottom: 28 },
  uploadCard: {
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 28,
  },
  uploadTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  previewImage: { width: '100%', height: 220, borderRadius: radius.sm, marginBottom: 14, backgroundColor: colors.line },
  uploadButtons: { marginTop: 14, gap: 10 },
  galleryTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 14 },
  empty: { color: colors.muted, fontStyle: 'italic', marginTop: 10 },
  grid: { gap: 16 },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: 200, backgroundColor: colors.mint },
  gridDetails: { padding: space.md },
  gridBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mint,
    color: colors.green,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 6,
  },
  gridCaption: { fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 19 },
  gridDate: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
