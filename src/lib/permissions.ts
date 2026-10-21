export type OrganizationRole = 'owner' | 'admin' | 'site_supervisor' | 'accountant' | 'viewer';

export const permissions = {
  company: { update: ['owner', 'admin'], manageTeam: ['owner', 'admin'], assignOwner: [] },
  projects: { read: ['owner', 'admin', 'site_supervisor', 'accountant', 'viewer'], manage: ['owner', 'admin'] },
  contracts: { read: ['owner', 'admin', 'accountant'], manage: ['owner', 'admin'] },
  customerPayments: { read: ['owner', 'admin', 'accountant'], manage: ['owner', 'admin', 'accountant'] },
  labour: { manageWorkers: ['owner', 'admin'], attendanceRead: ['owner', 'admin', 'site_supervisor'], attendanceWrite: ['owner', 'admin', 'site_supervisor'], wagesRead: ['owner', 'admin', 'accountant'], wagesWrite: ['owner', 'admin', 'accountant'] },
  materials: { read: ['owner', 'admin', 'site_supervisor', 'accountant'], manage: ['owner', 'admin', 'accountant'], approveOrders: ['owner', 'admin'] },
} as const satisfies Record<string, Record<string, readonly OrganizationRole[]>>;

export function hasPermission(
  role: OrganizationRole | null | undefined,
  module: keyof typeof permissions,
  action: string,
): boolean {
  if (!role) return false;
  const roles = (permissions[module] as Record<string, readonly OrganizationRole[]>)[action];
  return Boolean(roles?.includes(role));
}

export const roleLabels: Record<OrganizationRole, string> = {
  owner: 'Owner', admin: 'Admin', site_supervisor: 'Site Supervisor', accountant: 'Accountant', viewer: 'Read only',
};
