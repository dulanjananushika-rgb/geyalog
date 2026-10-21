import { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Button, Brand, ErrorNote } from '@/components/ui';
import { acceptOrganizationInvitation } from '@/lib/organizations';
import { useOrganization } from '@/providers/organization-provider';
import { useSession } from '@/providers/session-provider';
import { colors, space } from '@/theme/tokens';
export default function InvitationScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const { session } = useSession(); const { refresh, setActiveOrganization } = useOrganization();
  const acceptMutation = useMutation({
    mutationFn: async (inviteToken: string) => {
      const organizationId = await acceptOrganizationInvitation(inviteToken);
      await refresh();
      await setActiveOrganization(organizationId);
    },
    onSuccess: () => router.replace('/(app)'),
  });
  const { mutate: accept, isPending, isSuccess, isError, error: acceptError, reset } = acceptMutation;
  useEffect(() => {
    if (session && token && !isPending && !isSuccess && !isError) {
      accept(token);
    }
  }, [session, token, isPending, isSuccess, isError, accept]);
  const error = acceptError instanceof Error ? acceptError.message : '';
  return <SafeAreaView style={styles.page}><Brand /><View style={styles.body}><Text style={styles.title}>Company invitation</Text>{!token ? <ErrorNote>Invitation link eke token eka naha. Email eke link eka aye open karanna.</ErrorNote> : null}{error ? <ErrorNote>{error}</ErrorNote> : null}
    {isPending ? <ActivityIndicator size="large" color={colors.green} /> : session ? <Button title="Try again" onPress={() => reset()} /> : <><Text style={styles.text}>Invitation eka accept karanna sign in wenna, nathnam account ekak create karanna. Invite email eka athule thibba email address eka use karanna.</Text><Link href={{ pathname: '/(public)/sign-in', params: { token } }} style={styles.link}>Sign in to accept</Link><Link href={{ pathname: '/(public)/sign-up', params: { token } }} style={styles.link}>Create account to accept</Link></>}
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.canvas, padding: space.lg, paddingTop: 32 }, body: { flex: 1, justifyContent: 'center' }, title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginBottom: 16 }, text: { color: colors.muted, lineHeight: 23, marginVertical: 14 }, link: { color: colors.green, fontWeight: '800', paddingVertical: 14 } });
