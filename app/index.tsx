import { Redirect } from 'expo-router';
import { useSession } from '@/providers/session-provider';
export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? '/(app)' : '/(public)/welcome'} />;
}
