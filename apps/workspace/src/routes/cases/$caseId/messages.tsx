/**
 * Messaging Page - Redirect to unified inbox
 * This route redirects to /messages/$caseId for the unified inbox experience
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/cases/$caseId/messages')({
  beforeLoad: ({ params }) => {
    // Redirect to unified inbox with the selected conversation
    throw redirect({
      to: '/messages/$caseId',
      params: { caseId: params.caseId },
    })
  },
  component: () => null,
})
