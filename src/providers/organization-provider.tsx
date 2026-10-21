import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listOrganizations, type Organization } from '@/lib/organizations';
import { useSession } from '@/providers/session-provider';

type OrganizationState = {
  organizations: Organization[];
  organization: Organization | null;
  loading: boolean;
  error: Error | null;
  setActiveOrganization: (organizationId: string) => Promise<void>;
  refresh: () => Promise<void>;
};
const OrganizationContext = createContext<OrganizationState>({
  organizations: [], organization: null, loading: true, error: null,
  setActiveOrganization: async () => {}, refresh: async () => {},
});
const storageKey = (userId: string) => `geyalog-active-organization-${userId}`;

export function OrganizationProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ userId: string; organizationId: string } | null>(null);
  const userId = session?.user.id;
  const companies = useQuery({
    queryKey: ['organizations', session?.user.id],
    enabled: Boolean(session),
    queryFn: listOrganizations,
  });
  const companyList = companies.data;

  useEffect(() => {
    let live = true;
    if (!userId) return () => { live = false; };
    void AsyncStorage.getItem(storageKey(userId)).then(saved => {
      if (live && saved) setSelection({ userId, organizationId: saved });
    });
    return () => { live = false; };
  }, [userId]);

  const activeId = selection && selection.userId === userId ? selection.organizationId : null;

  const organization = useMemo(() => {
    const list = companies.data ?? [];
    return list.find(company => company.id === activeId) ?? list[0] ?? null;
  }, [activeId, companies.data]);

  const setActiveOrganization = useCallback(async (organizationId: string) => {
    const cachedAllowed = companyList?.some(company => company.id === organizationId) ?? false;
    const fresh = cachedAllowed ? null : await listOrganizations();
    const allowed = cachedAllowed || fresh?.some(company => company.id === organizationId);
    if (!allowed || !session) throw new Error('You are not an active member of that company.');
    // Drop tenant-scoped cached results before changing workspace so Company A
    // data cannot remain visible while Company B screens load.
    queryClient.removeQueries({ predicate: query => query.queryKey[0] === 'organization-scoped' });
    setSelection({ userId: session.user.id, organizationId });
    await AsyncStorage.setItem(storageKey(session.user.id), organizationId);
    await queryClient.invalidateQueries();
  }, [companyList, session, queryClient]);

  const refetchOrganizations = companies.refetch;
  const refresh = useCallback(async () => { await refetchOrganizations(); }, [refetchOrganizations]);
  return <OrganizationContext.Provider value={{
    organizations: companies.data ?? [], organization,
    loading: Boolean(session && companies.isLoading),
    error: companies.error instanceof Error ? companies.error : null,
    setActiveOrganization, refresh,
  }}>{children}</OrganizationContext.Provider>;
}

export const useOrganization = () => useContext(OrganizationContext);
