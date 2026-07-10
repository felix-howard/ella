// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CreateClientServiceLogInput } from '../../../lib/api-client'
import {
  getClientServicesTabMocks,
  resetClientServicesTabMocks,
  serviceLog,
} from './client-services-tab-test-helpers'
import { ClientServicesTab } from './client-services-tab'
import { buildServiceLogPayload } from './service-log-form-utils'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mocks = getClientServicesTabMocks()

describe('ClientServicesTab', () => {
  beforeEach(resetClientServicesTabMocks)

  it('wires latest and active queries to the service log API', async () => {
    renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)

    await Promise.all(mocks.queryOptions.map((option) => option.queryFn()))

    expect(mocks.list).toHaveBeenCalledWith('client_1', { limit: 200 })
    expect(mocks.list).toHaveBeenCalledWith('client_1', {
      limit: 200,
      status: ['WAITING_ON_CLIENT', 'ACTIVE'],
    })
  })

  it('renders quick-add defaults and empty states', () => {
    const markup = renderToStaticMarkup(
      <ClientServicesTab clientId="client_1" defaultTaxYear={2026} />
    )

    expect(markup).toContain('clientServices.quickAddTitle')
    expect(markup).toContain('value="2026"')
    expect(markup).toContain('clientServices.activeEmptyTitle')
    expect(markup).toContain('clientServices.emptyTitle')
    expect(markup).toContain('clientServices.addService')
  })

  it('renders active summary and chronological history', () => {
    mocks.activeQuery.data = {
      data: [
        serviceLog({
          id: 'service_waiting',
          serviceType: 'OTHER',
          customServiceName: 'Quarterly Planning',
          status: 'WAITING_ON_CLIENT',
          note: 'Waiting for January bank statements.',
        }),
        serviceLog({
          id: 'service_active',
          serviceType: 'BOOKKEEPING',
          status: 'ACTIVE',
          serviceDate: '2026-07-09T00:00:00.000Z',
        }),
      ],
    }
    mocks.latestQuery.data = {
      data: [
        ...mocks.activeQuery.data.data,
        serviceLog({
          id: 'service_done',
          status: 'COMPLETED',
          serviceDate: '2026-07-01T00:00:00.000Z',
        }),
      ],
    }

    const markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)

    expect(markup).toContain('clientServices.activeTitle')
    expect(markup).toContain('clientServices.activeCount:2')
    expect(markup).toContain('Quarterly Planning')
    expect(markup).toContain('clientServices.status.waitingOnClient')
    expect(markup).toContain('clientServices.serviceTypes.bookkeeping')
    expect(markup).toContain('clientServices.historyTitle')
    expect(markup).toContain('clientServices.status.completed')
    expect(markup).toContain('Alice Admin')
  })

  it('renders loading and retryable error states', () => {
    mocks.latestQuery = { ...mocks.latestQuery, isLoading: true }
    let markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)
    expect(markup).toContain('clientServices.loading')

    mocks.latestQuery = { ...mocks.latestQuery, isLoading: false, isError: true }
    markup = renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)
    expect(markup).toContain('clientServices.loadError')
    expect(markup).toContain('common.retry')
  })

  it('creates service logs through the create mutation wiring', async () => {
    renderToStaticMarkup(<ClientServicesTab clientId="client_1" />)
    const payload: CreateClientServiceLogInput = {
      serviceType: 'BOOKKEEPING',
      status: 'ACTIVE',
      taxYear: 2026,
      serviceDate: '2026-07-09',
      customServiceName: null,
      note: 'Monthly close',
    }

    await mocks.mutationOptions[0].mutationFn(payload)
    await mocks.mutationOptions[0].onSuccess?.()

    expect(mocks.create).toHaveBeenCalledWith('client_1', payload)
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['client-service-logs', 'client_1'],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'client', 'client_1'],
    })
  })

  it('submits quick-add through the rendered form controls', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<ClientServicesTab clientId="client_1" defaultTaxYear={2026} />)
    })

    const selects = container.querySelectorAll('select')
    const serviceDateInput = container.querySelector<HTMLInputElement>('input[type="date"]')
    const noteInput = container.querySelector<HTMLTextAreaElement>('#client-service-quick-note')
    const form = container.querySelector('form')

    expect(selects).toHaveLength(2)
    expect(serviceDateInput).not.toBeNull()
    expect(noteInput).not.toBeNull()
    expect(form).not.toBeNull()

    await act(async () => {
      setControlValue(selects[0], 'BOOKKEEPING')
      setControlValue(selects[1], 'WAITING_ON_CLIENT')
      setControlValue(serviceDateInput!, '2026-07-09')
      setControlValue(noteInput!, 'Need prior-year return')
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(mocks.create).toHaveBeenCalledWith('client_1', {
      serviceType: 'BOOKKEEPING',
      customServiceName: null,
      status: 'WAITING_ON_CLIENT',
      taxYear: 2026,
      serviceDate: '2026-07-09',
      note: 'Need prior-year return',
    })

    await act(async () => root.unmount())
    container.remove()
  })

  it('builds the quick-add payload expected by the create API', () => {
    const result = buildServiceLogPayload(
      {
        serviceType: 'OTHER',
        customServiceName: ' Quarterly Planning ',
        status: 'WAITING_ON_CLIENT',
        taxYear: '2026',
        serviceDate: '2026-07-09',
        note: ' Need prior-year return ',
      },
      (key) => key
    )

    expect(result).toEqual({
      payload: {
        serviceType: 'OTHER',
        customServiceName: 'Quarterly Planning',
        status: 'WAITING_ON_CLIENT',
        taxYear: 2026,
        serviceDate: '2026-07-09',
        note: 'Need prior-year return',
      },
    })
  })
})

function setControlValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
) {
  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}
