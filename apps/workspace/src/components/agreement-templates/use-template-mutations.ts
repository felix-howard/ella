/**
 * Mutations for agreement templates: create, update, archive, unarchive.
 * All success handlers invalidate the list query so the table refreshes.
 * Errors surface via toast — caller may inspect mutation state for inline UX.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { AgreementTemplateType } from '../../lib/api-client'

const LIST_KEY = ['agreement-templates']

export interface CreateTemplateInput {
  name: string
  type: AgreementTemplateType
  contentHtml: string
  defaultDepositAmount: string | null
}

export interface UpdateTemplateInput {
  id: string
  name?: string
  contentHtml?: string
  defaultDepositAmount?: string | null
}

export function useTemplateMutations() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY })

  const create = useMutation({
    mutationFn: (input: CreateTemplateInput) => api.agreementTemplates.create(input),
    onSuccess: () => {
      invalidate()
      toast.success(t('agreementTemplates.toast.created'))
    },
    onError: (err: Error) => toast.error(err.message || t('agreementTemplates.toast.saveFailed')),
  })

  const update = useMutation({
    mutationFn: ({ id, ...rest }: UpdateTemplateInput) =>
      api.agreementTemplates.update(id, rest),
    onSuccess: () => {
      invalidate()
      toast.success(t('agreementTemplates.toast.updated'))
    },
    onError: (err: Error) => toast.error(err.message || t('agreementTemplates.toast.saveFailed')),
  })

  const archive = useMutation({
    mutationFn: (id: string) => api.agreementTemplates.archive(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('agreementTemplates.toast.archived'))
    },
    onError: (err: Error) => toast.error(err.message || t('agreementTemplates.toast.saveFailed')),
  })

  const unarchive = useMutation({
    mutationFn: (id: string) => api.agreementTemplates.unarchive(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('agreementTemplates.toast.unarchived'))
    },
    onError: (err: Error) => toast.error(err.message || t('agreementTemplates.toast.saveFailed')),
  })

  return { create, update, archive, unarchive }
}
