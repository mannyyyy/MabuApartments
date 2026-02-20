import { NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/security/rate-limit-redis"
import { getRequestIp } from "@/lib/security/request-ip"
import { issueOfficialIdUploadToken } from "@/lib/security/upload-token"

const TOKEN_WINDOW_MS = 10 * 60 * 1000
const TOKEN_LIMIT = 12
const TOKEN_TTL_SECONDS = 10 * 60

function getRetryAfterSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req)
    const rateLimit = await enforceRateLimit({
      bucket: "official_id_upload_token",
      identifier: ip,
      limit: TOKEN_LIMIT,
      windowMs: TOKEN_WINDOW_MS,
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          message: "Too many upload token requests. Please try again shortly.",
          retryAfterSeconds: getRetryAfterSeconds(rateLimit.resetAt),
        },
        { status: 429 },
      )
    }

    const token = await issueOfficialIdUploadToken(ip, TOKEN_TTL_SECONDS)
    return NextResponse.json({ token, expiresInSeconds: TOKEN_TTL_SECONDS })
  } catch (error) {
    console.error("Failed to issue official ID upload token", error)
    return NextResponse.json({ message: "Failed to issue upload token" }, { status: 500 })
  }
}
