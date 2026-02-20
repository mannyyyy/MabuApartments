import crypto from "crypto"

type UploadTokenPayload = {
  purpose: "official_id_upload"
  nonce: string
  exp: number
  ip: string
}

const memoryNonces = new Map<string, number>()

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

function getUploadTokenSecret() {
  const secret = process.env.UPLOAD_TOKEN_SECRET
  if (!secret) {
    throw new Error("UPLOAD_TOKEN_SECRET is not configured")
  }
  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signTokenPayload(encodedPayload: string) {
  const secret = getUploadTokenSecret()
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

function signaturesMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)

  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

function getNonceKey(nonce: string) {
  return `upload_token_nonce:${nonce}`
}

async function callUpstash(path: string) {
  const config = getRedisConfig()
  if (!config) {
    return null
  }

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
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

async function setNonceWithTtl(nonce: string, ttlSeconds: number) {
  const key = encodeURIComponent(getNonceKey(nonce))
  try {
    const redisResponse = await callUpstash(`/set/${key}/1`)
    if (redisResponse !== null) {
      await callUpstash(`/expire/${key}/${ttlSeconds}`)
      return
    }
  } catch (error) {
    console.error("Falling back to in-memory nonce store", error)
  }

  const expiresAt = Date.now() + ttlSeconds * 1000
  memoryNonces.set(nonce, expiresAt)
}

async function consumeNonce(nonce: string) {
  const key = encodeURIComponent(getNonceKey(nonce))
  try {
    const redisResponse = await callUpstash(`/get/${key}`)
    if (redisResponse !== null) {
      if (!redisResponse) {
        return false
      }
      await callUpstash(`/del/${key}`)
      return true
    }
  } catch (error) {
    console.error("Falling back to in-memory nonce read", error)
  }

  const expiresAt = memoryNonces.get(nonce)
  if (!expiresAt) {
    return false
  }
  if (expiresAt <= Date.now()) {
    memoryNonces.delete(nonce)
    return false
  }
  memoryNonces.delete(nonce)
  return true
}

export async function issueOfficialIdUploadToken(ip: string, ttlSeconds = 600) {
  const nonce = crypto.randomUUID()
  const payload: UploadTokenPayload = {
    purpose: "official_id_upload",
    nonce,
    exp: Date.now() + ttlSeconds * 1000,
    ip,
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = signTokenPayload(encodedPayload)

  await setNonceWithTtl(nonce, ttlSeconds)
  return `${encodedPayload}.${signature}`
}

export async function consumeOfficialIdUploadToken(token: string, expectedIp: string) {
  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "invalid_format" as const }
  }

  const expectedSignature = signTokenPayload(encodedPayload)
  if (!signaturesMatch(signature, expectedSignature)) {
    return { valid: false, reason: "invalid_signature" as const }
  }

  let payload: UploadTokenPayload
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as UploadTokenPayload
  } catch {
    return { valid: false, reason: "invalid_payload" as const }
  }

  if (payload.purpose !== "official_id_upload") {
    return { valid: false, reason: "invalid_purpose" as const }
  }

  if (payload.exp <= Date.now()) {
    return { valid: false, reason: "expired" as const }
  }

  if (payload.ip !== expectedIp) {
    return { valid: false, reason: "ip_mismatch" as const }
  }

  const consumed = await consumeNonce(payload.nonce)
  if (!consumed) {
    return { valid: false, reason: "replayed_or_unknown" as const }
  }

  return { valid: true as const }
}
