import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientAssignedStaff } from './client-assigned-staff'

const mocks = vi.hoisted(() => ({
  canManageClients: false,
  membersData: undefined as undefined | { data: Array<{ id: string; name: string; avatarUrl: string | null; isActive?: boolean }> },
  mutationOptions: null as null | {
    mutationFn: (staffIds: string[]) => Promise<unknown>
    onSuccess: (
      data: unknown,
      nextStaffIds: string[],
      context?: { previousStaffIds?: string[] }
    ) => Promise<void>
  },
  updateManagedBy: vi.fn(),
  invalidateQueries: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mocks.membersData }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: (options: {
    mutationFn: (staffIds: string[]) => Promise<unknown>
    onSuccess: (
      data: unknown,
      nextStaffIds: string[],
      context?: { previousStaffIds?: string[] }
    ) => Promise<void>
  }) => {
    mocks.mutationOptions = options
    return { mutate: vi.fn(), isPending: false }
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../../hooks/use-org-role', () => ({
  useOrgRole: () => ({ canManageClients: mocks.canManageClients }),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    clients: { updateManagedBy: mocks.updateManagedBy },
    team: { listMembers: vi.fn() },
  },
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../../../lib/formatters', () => ({
  getAvatarColor: () => ({ bg: 'bg-muted', text: 'text-muted-foreground' }),
  getInitials: (name: string) => name.slice(0, 2).toUpperCase(),
}))

vi.mock('@ella/ui', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

describe('ClientAssignedStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canManageClients = false
    mocks.membersData = undefined
    mocks.mutationOptions = null
    mocks.updateManagedBy.mockResolvedValue({ data: { managedByStaff: [] } })
  })

  it('renders multiple assigned managers for non-admin viewers', () => {
    const markup = renderToStaticMarkup(
      <ClientAssignedStaff
        clientId="client-1"
        managedByStaff={[
          { id: 'staff-1', name: 'Alice Admin', avatarUrl: null },
          { id: 'staff-2', name: 'Bob Bookkeeper', avatarUrl: null },
        ]}
      />,
    )

    expect(markup).toContain('Alice Admin')
    expect(markup).toContain('Bob Bookkeeper')
  })

  it('uses the multi-manager payload when wiring admin mutations', async () => {
    mocks.canManageClients = true
    mocks.membersData = {
      data: [
        { id: 'staff-1', name: 'Alice Admin', avatarUrl: null, isActive: true },
        { id: 'staff-2', name: 'Bob Bookkeeper', avatarUrl: null, isActive: true },
      ],
    }

    renderToStaticMarkup(
      <ClientAssignedStaff
        clientId="client-1"
        managedByStaff={[{ id: 'staff-1', name: 'Alice Admin', avatarUrl: null }]}
      />,
    )
    await mocks.mutationOptions?.mutationFn(['staff-1', 'staff-2'])

    expect(mocks.updateManagedBy).toHaveBeenCalledWith('client-1', ['staff-1', 'staff-2'])
  })

  it('shows every selected manager name in the closed admin selector', () => {
    mocks.canManageClients = true
    mocks.membersData = {
      data: [
        { id: 'staff-1', name: 'Amber Tran', avatarUrl: null, isActive: true },
        { id: 'staff-2', name: 'Felix Huynh', avatarUrl: null, isActive: true },
        { id: 'staff-3', name: 'Jessie Nguyen', avatarUrl: null, isActive: true },
      ],
    }

    const markup = renderToStaticMarkup(
      <ClientAssignedStaff
        clientId="client-1"
        managedByStaff={[
          { id: 'staff-1', name: 'Amber Tran', avatarUrl: null },
          { id: 'staff-2', name: 'Felix Huynh', avatarUrl: null },
          { id: 'staff-3', name: 'Jessie Nguyen', avatarUrl: null },
        ]}
      />,
    )

    expect(markup).toContain('Amber Tran')
    expect(markup).toContain('Felix Huynh')
    expect(markup).toContain('Jessie Nguyen')
    expect(markup).not.toContain('+1')
  })

  it('supports clearing all managers and invalidates affected profile caches', async () => {
    mocks.canManageClients = true
    mocks.membersData = {
      data: [
        { id: 'staff-1', name: 'Alice Admin', avatarUrl: null, isActive: true },
        { id: 'staff-2', name: 'Bob Bookkeeper', avatarUrl: null, isActive: true },
      ],
    }

    renderToStaticMarkup(
      <ClientAssignedStaff
        clientId="client-1"
        managedByStaff={[
          { id: 'staff-1', name: 'Alice Admin', avatarUrl: null },
          { id: 'staff-2', name: 'Bob Bookkeeper', avatarUrl: null },
        ]}
      />,
    )
    await mocks.mutationOptions?.mutationFn([])
    await mocks.mutationOptions?.onSuccess({}, [], { previousStaffIds: ['staff-1', 'staff-2'] })

    expect(mocks.updateManagedBy).toHaveBeenCalledWith('client-1', [])
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['client'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['clients'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team-member-profile', 'staff-1'] })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team-member-profile', 'staff-2'] })
  })
})
