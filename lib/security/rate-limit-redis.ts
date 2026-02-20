type RateLimitInput = {
  bucket: string
  identifier: string
  limit: number
  windowMs: number
}

type RateLimitResult = {
  limited: boolean
  remaining: number
  resetAt: number
}

const memoryHits = new Map<string, { count: number; resetAt: number }>()

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return null
  }
  return {
    url: url.replace(/\/$/, ""),
    token,
  }
}

async function callUpstash(path: string, token: string) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Upstash request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as { result?: unknown; error?: string }
  if (payload.error) {
    throw new Error(payload.error)
  }
  return payload.result
}

async function enforceRedisRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const config = getRedisConfig()
  if (!config) {
    return enforceMemoryRateLimit(input)
  }

  const now = Date.now()
  const windowIndex = Math.floor(now / input.windowMs)
  const key = `${input.bucket}:${input.identifier}:${windowIndex}`
  const keyPath = encodeURIComponent(key)
  const resetAt = (windowIndex + 1) * input.windowMs

  const incrResult = await callUpstash(`${config.url}/incr/${keyPath}`, config.token)
  const currentCount = Number(incrResult)
  if (!Number.isFinite(currentCount)) {
    throw new Error("Unable to parse Upstash INCR result")
  }

  if (currentCount === 1) {
    const ttlSeconds = Math.max(1, Math.ceil(input.windowMs / 1000))
    await callUpstash(`${config.url}/expire/${keyPath}/${ttlSeconds}`, config.token)
  }

  return {
    limited: currentCount > input.limit,
    remaining: Math.max(0, input.limit - currentCount),
    resetAt,
  }
}

function enforceMemoryRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now()
  const key = `${input.bucket}:${input.identifier}`
  const existing = memoryHits.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs
    memoryHits.set(key, { count: 1, resetAt })
    return {
      limited: false,
      remaining: Math.max(0, input.limit - 1),
      resetAt,
    }
  }

  existing.count += 1
  memoryHits.set(key, existing)
  return {
    limited: existing.count > input.limit,
    remaining: Math.max(0, input.limit - existing.count),
    resetAt: existing.resetAt,
  }
}

export async function enforceRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  try {
    return await enforceRedisRateLimit(input)
  } catch (error) {
    console.error("Falling back to in-memory rate limiting", error)
    return enforceMemoryRateLimit(input)
  }
}
