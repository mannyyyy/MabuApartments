import { NextRequest, NextResponse } from "next/server"

type RateLimitPolicy = {
  windowMs: number
  maxRequests: number
}

const DEFAULT_POLICY: RateLimitPolicy = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
}

const ROUTE_POLICIES: Array<{ matcher: RegExp; policy: RateLimitPolicy; bucket: string }> = [
  {
    matcher: /^\/api\/reviews$/,
    policy: { windowMs: 15 * 60 * 1000, maxRequests: 60 },
    bucket: "reviews",
  },
  {
    matcher: /^\/api\/unavailable-dates$/,
    policy: { windowMs: 15 * 60 * 1000, maxRequests: 60 },
    bucket: "unavailable_dates",
  },
]

const ipHits = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = req.headers.get("x-real-ip")
  return realIp?.trim() || "unknown"
}

function getPolicy(pathname: string) {
  const match = ROUTE_POLICIES.find((item) => item.matcher.test(pathname))
  if (!match) {
    return { policy: DEFAULT_POLICY, bucket: "default" }
  }
  return { policy: match.policy, bucket: match.bucket }
}

function isRateLimited(key: string, now: number, policy: RateLimitPolicy): boolean {
  const hit = ipHits.get(key)
  if (!hit || hit.resetAt <= now) {
    ipHits.set(key, { count: 1, resetAt: now + policy.windowMs })
    return false
  }

  hit.count += 1
  ipHits.set(key, hit)
  return hit.count > policy.maxRequests
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
  const { policy, bucket } = getPolicy(pathname)
  const key = `${ip}:${bucket}`
  if (isRateLimited(key, now, policy)) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Too many requests, please try again later." } },
      { status: 429 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
