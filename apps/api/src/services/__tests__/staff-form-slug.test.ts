import { describe, expect, it, vi } from 'vitest'
import { generateUniqueStaffFormSlug, getStaffFormSlugData } from '../staff-form-slug'

function mockDb() {
  return {
    staff: {
      findFirst: vi.fn(),
    },
  }
}

describe('staff form slug service', () => {
  it('generates a six digit slug that is unique within the organization', async () => {
    const db = mockDb()
    db.staff.findFirst.mockResolvedValueOnce(null)

    const slug = await generateUniqueStaffFormSlug(db as never, 'org_1')

    expect(slug).toMatch(/^\d{6}$/)
    expect(db.staff.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', formSlug: slug },
      select: { id: true },
    })
  })

  it('retries when a generated slug already exists', async () => {
    const db = mockDb()
    db.staff.findFirst
      .mockResolvedValueOnce({ id: 'staff_existing' })
      .mockResolvedValueOnce(null)

    const slug = await generateUniqueStaffFormSlug(db as never, 'org_1', 'staff_new')

    expect(slug).toMatch(/^\d{6}$/)
    expect(db.staff.findFirst).toHaveBeenCalledTimes(2)
    expect(db.staff.findFirst).toHaveBeenLastCalledWith({
      where: {
        organizationId: 'org_1',
        formSlug: slug,
        id: { not: 'staff_new' },
      },
      select: { id: true },
    })
  })

  it('keeps existing slugs unchanged', async () => {
    const db = mockDb()

    const data = await getStaffFormSlugData(db as never, 'org_1', {
      id: 'staff_1',
      formSlug: 'felix',
    })

    expect(data).toEqual({})
    expect(db.staff.findFirst).not.toHaveBeenCalled()
  })
})
