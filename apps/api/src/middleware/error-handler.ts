/**
 * Global error handler middleware for Hono
 * Handles Zod validation errors, Prisma errors, and generic errors
 */
import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'

interface PrismaError extends Error {
  code?: string
  meta?: Record<string, unknown>
}

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('API Error:', err)

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      400
    )
  }

  // Prisma errors - check by code pattern
  const prismaErr = err as PrismaError
  if (prismaErr.code?.startsWith('P')) {
    if (prismaErr.code === 'P2002') {
      return c.json(
        {
          error: 'DUPLICATE_ERROR',
          message: 'Resource already exists',
        },
        409
      )
    }
    if (prismaErr.code === 'P2025') {
      return c.json(
        {
          error: 'NOT_FOUND',
          message: 'Resource not found',
        },
        404
      )
    }
    // P2003: Foreign key constraint failed
    if (prismaErr.code === 'P2003') {
      return c.json(
        {
          error: 'REFERENCE_ERROR',
          message: 'Referenced resource not found',
        },
        400
      )
    }
  }

  // Generic error with status code
  const statusCode = (err as { status?: number }).status || 500
  const message =
    statusCode === 500 ? 'An unexpected error occurred' : err.message

  return c.json(
    {
      error: statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR',
      message,
    },
    statusCode as 400 | 401 | 403 | 404 | 500
  )
}
