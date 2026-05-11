import { Children, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { ClientPreview } from '../../../../lib/api-client'
import { IndividualScheduleCActivities } from './individual-schedule-c-activities'
import { ScheduleCBusinessSummaryList } from './schedule-c-business-summary-list'

function TestScheduleCTab({ caseId }: { caseId: string }) {
  return <section data-testid="own-schedule-c" data-case-id={caseId} />
}

const linkedBusiness: ClientPreview = {
  id: 'business_1',
  name: 'ABC Nails',
  clientType: 'BUSINESS',
  phone: '+15555550100',
  businessType: 'SMLLC',
  scheduleCExpense: {
    id: 'schedule_c_1',
    status: 'SUBMITTED',
    updatedAt: '2026-05-11T00:00:00.000Z',
  },
}

describe('IndividualScheduleCActivities', () => {
  it('renders the individual own Schedule C panel before linked business rows', () => {
    const tree = IndividualScheduleCActivities({
      ScheduleCTabComponent: TestScheduleCTab,
      caseId: 'individual_case_1',
      clientName: 'Lan Vu',
      businessName: null,
      linkedBusinesses: [linkedBusiness],
    })

    if (!isValidElement(tree)) {
      throw new Error('Expected IndividualScheduleCActivities to return a React element')
    }

    const typedTree = tree as ReactElement<{ children: ReactNode }>
    const children = Children.toArray(typedTree.props.children)
    const ownPanel = children[0]
    const linkedList = children[1]

    if (!isValidElement(ownPanel) || !isValidElement(linkedList)) {
      throw new Error('Expected own panel and linked business list React elements')
    }

    const typedOwnPanel = ownPanel as ReactElement<{ caseId: string }>
    const typedLinkedList = linkedList as ReactElement<{ businesses: ClientPreview[] }>

    expect(typedOwnPanel.type).toBe(TestScheduleCTab)
    expect(typedOwnPanel.props.caseId).toBe('individual_case_1')
    expect(typedLinkedList.type).toBe(ScheduleCBusinessSummaryList)
    expect(typedLinkedList.props.businesses).toEqual([linkedBusiness])
  })

  it('renders only the individual own Schedule C panel when no linked businesses have Schedule C', () => {
    const tree = IndividualScheduleCActivities({
      ScheduleCTabComponent: TestScheduleCTab,
      caseId: 'individual_case_2',
      clientName: 'Lan Vu',
      businessName: null,
      linkedBusinesses: [],
    })

    expect(Children.toArray(tree.props.children)).toHaveLength(1)
  })
})
