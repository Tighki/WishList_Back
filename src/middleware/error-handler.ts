import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { OzonParseError } from '../services/ozon-parser.js'

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof OzonParseError) {
    res.status(422).json({
      error: error.message,
      code: error.code,
    })
    return
  }

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
