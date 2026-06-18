import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const message = error.errors[0]?.message ?? 'Некорректные данные запроса'
    res.status(400).json({
      error: message,
      code: 'VALIDATION_ERROR',
    })
    return
  }

  console.error('[api]', error)
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    code: 'INTERNAL_ERROR',
  })
}
