/**
 * Firm counter-signer choice for agreements that carry a firm signature
 * (NDA, Engagement Letter, uploaded PDF). Lets an ops admin send on behalf of
 * the CPA so the client sees the CPA's name, title, and signature.
 *
 * Default order: picked now -> last pick remembered for this user -> draft
 * creator (previous server default) -> current staff -> first eligible signer.
 * The server re-validates the chosen id.
 */
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { api, type AgreementFirmSigner } from '../../lib/api-client'

const STORAGE_KEY_PREFIX = 'ella:agreement-firm-signer:'

function storageKey(orgId?: string | null, userId?: string | null): string | null {
  return orgId && userId ? `${STORAGE_KEY_PREFIX}${orgId}:${userId}` : null
}

function readStoredSigner(key: string | null): string | null {
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredSigner(key: string | null, staffId: string) {
  if (!key) return
  try {
    localStorage.setItem(key, staffId)
  } catch {
    // Storage blocked (private mode) — the choice just won't be remembered.
  }
}

export function resolveDefaultFirmSignerId(input: {
  signers: AgreementFirmSigner[]
  candidates: Array<string | null | undefined>
}): string | undefined {
  const eligible = input.candidates.find(
    (id) => id && input.signers.some((s) => s.id === id),
  )
  return eligible ?? input.signers[0]?.id
}

export interface FirmSignerChoice {
  signers: AgreementFirmSigner[]
  isLoading: boolean
  isError: boolean
  /** Selected signer id; undefined until the eligible list has loaded. */
  firmSignerStaffId: string | undefined
  setFirmSignerStaffId: (staffId: string) => void
}

export function useFirmSignerChoice(
  enabled: boolean,
  options: { draftCreatorId?: string | null } = {},
): FirmSignerChoice {
  const { orgId, userId } = useAuth()
  const signersQuery = useQuery({
    queryKey: ['agreement-firm-signers', orgId ?? 'no-org'],
    queryFn: () => api.staff.listAgreementFirmSigners(),
    enabled: enabled && Boolean(orgId),
    staleTime: 60000,
  })
  const meQuery = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => api.staff.me(),
    enabled,
    staleTime: 60000,
  })
  // Clerk can resolve org/user after first render, so derive the key per render.
  const key = storageKey(orgId, userId)
  const storedSigner = useMemo(() => readStoredSigner(key), [key])
  const [picked, setPicked] = useState<string | null>(null)

  const signers = useMemo(() => signersQuery.data?.data ?? [], [signersQuery.data])
  const firmSignerStaffId = useMemo(
    () =>
      resolveDefaultFirmSignerId({
        signers,
        candidates: [picked, storedSigner, options.draftCreatorId, meQuery.data?.id],
      }),
    [meQuery.data?.id, options.draftCreatorId, picked, signers, storedSigner],
  )

  const setFirmSignerStaffId = useCallback((staffId: string) => {
    setPicked(staffId)
    writeStoredSigner(key, staffId)
  }, [key])

  return {
    signers,
    isLoading: enabled && (signersQuery.isLoading || meQuery.isLoading),
    isError: enabled && signersQuery.isError,
    firmSignerStaffId: enabled ? firmSignerStaffId : undefined,
    setFirmSignerStaffId,
  }
}
