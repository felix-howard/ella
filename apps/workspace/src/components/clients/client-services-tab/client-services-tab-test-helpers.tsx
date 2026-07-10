import type React from 'react'
import { vi } from 'vitest'
import type { ClientServiceLog } from '../../../lib/api-client'

const mocks = vi.hoisted(() => ({
  activeQuery: { isLoading: false, isError: false, data: { data: [] as ClientServiceLog[] } },
  latestQuery: { isLoading: false, isError: false, data: { data: [] as ClientServiceLog[] } },
  queryOptions: [] as Array<{ queryKey: readonly unknown[]; queryFn: () => unknown }>,
  mutationOptions: [] as Array<{
    mutationFn: (payload: unknown) => unknown
    onSuccess?: () => Promise<void>
    onError?: () => void
  }>,
  invalidateQueries: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteLog: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

export function getClientServicesTabMocks() {
  return mocks
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: readonly unknown[]; queryFn: () => unknown }) => {
    mocks.queryOptions.push(options)
    return options.queryKey[2] === 'active' ? mocks.activeQuery : mocks.latestQuery
  },
  useMutation: (options: {
    mutationFn: (payload: unknown) => unknown
    onSuccess?: () => Promise<void>
    onError?: () => void
  }) => {
    mocks.mutationOptions.push(options)
    return {
      mutateAsync: async (payload: unknown) => {
        try {
          const result = await options.mutationFn(payload)
          await options.onSuccess?.()
          return result
        } catch (error) {
          options.onError?.()
          throw error
        }
      },
      isPending: false,
    }
  },
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: { count?: number; taxYear?: number }) => {
      if (values?.count !== undefined) return `${key}:${values.count}`
      if (values?.taxYear !== undefined) return `${key}:${values.taxYear}`
      return key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
  Button: ({
    children,
    className,
    disabled,
    onClick,
    type = 'button',
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  InputField: ({
    label,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <label>
      {label}
      <input {...props} />
    </label>
  ),
  SelectField: ({
    label,
    options,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label: string
    options: Array<{ value: string; label: string }>
  }) => (
    <label>
      {label}
      <select {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    clients: {
      serviceLogs: {
        list: mocks.list,
        create: mocks.create,
        update: mocks.update,
        delete: mocks.deleteLog,
      },
    },
  },
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))

export function serviceLog(overrides: Partial<ClientServiceLog> = {}): ClientServiceLog {
  return {
    id: 'service_log_1',
    clientId: 'client_1',
    serviceType: 'INDIVIDUAL_TAX_RETURN',
    customServiceName: null,
    status: 'ACTIVE',
    taxYear: 2026,
    serviceDate: '2026-07-08T00:00:00.000Z',
    note: null,
    createdBy: { id: 'staff_1', name: 'Alice Admin', avatarUrl: null },
    updatedBy: { id: 'staff_1', name: 'Alice Admin', avatarUrl: null },
    createdAt: '2026-07-08T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z',
    ...overrides,
  }
}

export function resetClientServicesTabMocks() {
  vi.clearAllMocks()
  mocks.queryOptions.length = 0
  mocks.mutationOptions.length = 0
  mocks.latestQuery = { isLoading: false, isError: false, data: { data: [] } }
  mocks.activeQuery = { isLoading: false, isError: false, data: { data: [] } }
  mocks.list.mockResolvedValue({ data: [] })
  mocks.create.mockResolvedValue({ data: serviceLog() })
  mocks.update.mockResolvedValue({ data: serviceLog() })
  mocks.deleteLog.mockResolvedValue({ success: true, data: serviceLog() })
}
