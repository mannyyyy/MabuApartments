import type { NextRequest } from "next/server"

export function getRequestIp(req: Request | NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  const realIp = req.headers.get("x-real-ip")
  return realIp?.trim() || "unknown"
}
