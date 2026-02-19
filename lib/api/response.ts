import { NextResponse } from "next/server"

type ErrorPayload = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(message: string, status = 500, code = "INTERNAL_ERROR", details?: unknown) {
  const payload: ErrorPayload = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  }
  return NextResponse.json(payload, { status })
}
