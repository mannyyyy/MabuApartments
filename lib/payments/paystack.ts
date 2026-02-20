type PaystackInitializePayload = {
  email: string
  amount: number
  metadata: Record<string, unknown>
  channels?: string[]
}

type PaystackInitializeOptions = {
  callbackBaseUrl?: string
}

type PaystackInitializeResponse = {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

type PaystackVerifyResponse = {
  status: boolean
  message: string
  data?: {
    status: string
    reference: string
    amount: number
    currency: string
    paid_at: string | null
    metadata: Record<string, unknown>
    customer: {
      email: string
    }
  }
}

type PaymentInitErrorOptions = {
  attempts: number
  durationMs: number
  statusCode?: number
  cause?: unknown
}

class PaymentInitError extends Error {
  readonly attempts: number
  readonly durationMs: number
  readonly statusCode?: number
  readonly retryable: boolean

  constructor(message: string, retryable: boolean, options: PaymentInitErrorOptions) {
    super(message)
    this.name = "PaymentInitError"
    this.attempts = options.attempts
    this.durationMs = options.durationMs
    this.statusCode = options.statusCode
    this.retryable = retryable
    if (options.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

export class PaymentInitTimeoutError extends PaymentInitError {
  constructor(message: string, options: PaymentInitErrorOptions) {
    super(message, true, options)
    this.name = "PaymentInitTimeoutError"
  }
}

export class PaymentInitRetryableError extends PaymentInitError {
  constructor(message: string, options: PaymentInitErrorOptions) {
    super(message, true, options)
    this.name = "PaymentInitRetryableError"
  }
}

export class PaymentInitNonRetryableError extends PaymentInitError {
  constructor(message: string, options: PaymentInitErrorOptions) {
    super(message, false, options)
    this.name = "PaymentInitNonRetryableError"
  }
}

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured")
  }
  return secret
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

function isAbortError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError")
}

function isRetryableMessage(message: string) {
  const normalized = message.trim().toLowerCase()
  return (
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("service unavailable") ||
    normalized.includes("gateway")
  )
}

async function sleep(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function computeBackoffMs(baseMs: number, attempt: number) {
  const jitterMs = Math.floor(Math.random() * 200)
  return baseMs * 2 ** Math.max(0, attempt - 1) + jitterMs
}

async function parseInitializeResponse(response: Response): Promise<PaystackInitializeResponse | null> {
  try {
    return (await response.json()) as PaystackInitializeResponse
  } catch {
    return null
  }
}

function normalizeCallbackBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }

  return `https://${trimmed}`
}

function resolveCallbackBaseUrl(callbackBaseUrl?: string) {
  const candidates = [callbackBaseUrl, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL]
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const normalized = normalizeCallbackBaseUrl(candidate)
    if (normalized) {
      return normalized
    }
  }

  return "http://localhost:3000"
}

export async function initializePaystackTransaction(
  input: PaystackInitializePayload,
  options: PaystackInitializeOptions = {},
) {
  const callbackBaseUrl = resolveCallbackBaseUrl(options.callbackBaseUrl)
  const callbackUrl = `${callbackBaseUrl}/payment-success`
  const timeoutMs = getPositiveIntegerEnv("PAYSTACK_INIT_TIMEOUT_MS", 10000)
  const maxRetries = getPositiveIntegerEnv("PAYSTACK_INIT_MAX_RETRIES", 2)
  const retryBaseMs = getPositiveIntegerEnv("PAYSTACK_INIT_RETRY_BASE_MS", 400)
  const maxAttempts = 1 + maxRetries
  const startedAt = Date.now()

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getPaystackSecret()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amount,
          metadata: input.metadata,
          callback_url: callbackUrl,
          channels: input.channels ?? ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
        }),
        signal: controller.signal,
      })

      const payload = await parseInitializeResponse(response)
      if (response.ok && payload?.status && payload.data) {
        return payload.data
      }

      const message = payload?.message || `Paystack initialization failed with status ${response.status}`
      const retryable = response.status === 429 || response.status >= 500 || isRetryableMessage(message)

      if (retryable && attempt < maxAttempts) {
        await sleep(computeBackoffMs(retryBaseMs, attempt))
        continue
      }

      if (retryable) {
        throw new PaymentInitRetryableError(message, {
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          statusCode: response.status,
        })
      }

      throw new PaymentInitNonRetryableError(message, {
        attempts: attempt,
        durationMs: Date.now() - startedAt,
        statusCode: response.status,
      })
    } catch (error) {
      const networkFailure = error instanceof TypeError
      if ((isAbortError(error) || networkFailure) && attempt < maxAttempts) {
        await sleep(computeBackoffMs(retryBaseMs, attempt))
        continue
      }

      if (isAbortError(error)) {
        throw new PaymentInitTimeoutError(`Request timed out after ${timeoutMs}ms`, {
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          cause: error,
        })
      }

      if (networkFailure) {
        throw new PaymentInitRetryableError("Network error while reaching Paystack", {
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          cause: error,
        })
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new PaymentInitRetryableError("Paystack initialization failed after retries", {
    attempts: maxAttempts,
    durationMs: Date.now() - startedAt,
  })
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
    },
  })

  const payload = (await response.json()) as PaystackVerifyResponse
  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message || "Paystack transaction verification failed")
  }

  return payload.data
}
