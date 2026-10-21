import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '@/providers/session-provider';
import { OrganizationProvider } from '@/providers/organization-provider';
import { queryClient } from '@/lib/query-client';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/tokens';

function Routes() {
  const { session, loading } = useSession();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.green} size="large" /></View>;
  return <OrganizationProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="invite" />
    <Stack.Screen name="auth/callback" />
    <Stack.Protected guard={!session}>
      <Stack.Screen name="(public)" />
    </Stack.Protected>
    <Stack.Protected guard={Boolean(session)}>
      <Stack.Screen name="(app)" />
    </Stack.Protected>
  </Stack></OrganizationProvider>;
}

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><SessionProvider><Routes /></SessionProvider></QueryClientProvider>;
}
