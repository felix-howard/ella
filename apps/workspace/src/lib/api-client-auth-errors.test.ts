import { describe, expect, it } from 'vitest'
import { ApiError, isDisabledAccountError } from './api-client'

describe('api auth error helpers', () => {
  it('detects disabled staff account responses', () => {
    const error = new ApiError(403, 'ERROR', 'Account has been disabled', {
      error: 'ERROR',
      message: 'Account has been disabled',
    })

    expect(isDisabledAccountError(error)).toBe(true)
  })

  it('does not treat other 403 errors as disabled accounts', () => {
    const error = new ApiError(403, 'ERROR', 'Admin access required', {
      error: 'ERROR',
      message: 'Admin access required',
    })

    expect(isDisabledAccountError(error)).toBe(false)
  })
})
