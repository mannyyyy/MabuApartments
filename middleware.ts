import { NextRequest, NextResponse } from "next/server"

const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 100
const ipHits = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = req.headers.get("x-real-ip")
  return realIp?.trim() || "unknown"
}

function isRateLimited(ip: string, now: number): boolean {
  const hit = ipHits.get(ip)
  if (!hit || hit.resetAt <= now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  hit.count += 1
  ipHits.set(ip, hit)
  return hit.count > MAX_REQUESTS
}

function pruneExpired(now: number) {
  for (const [ip, hit] of ipHits.entries()) {
    if (hit.resetAt <= now) {
      ipHits.delete(ip)
    }
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip webhook route to avoid blocking legitimate provider retries.
  if (pathname === "/api/paystack-webhook") {
    return NextResponse.next()
  }

  const now = Date.now()
  pruneExpired(now)

  const ip = getClientIp(req)
  if (isRateLimited(ip, now)) {
    return NextResponse.json(
      { message: "Too many requests, please try again later." },
      { status: 429 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
