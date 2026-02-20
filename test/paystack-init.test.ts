import test from "node:test"
import assert from "node:assert/strict"
import {
  initializePaystackTransaction,
  PaymentInitNonRetryableError,
  PaymentInitTimeoutError,
} from "../lib/payments/paystack"

const originalFetch = global.fetch
const originalEnv = {
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  PAYSTACK_INIT_TIMEOUT_MS: process.env.PAYSTACK_INIT_TIMEOUT_MS,
  PAYSTACK_INIT_MAX_RETRIES: process.env.PAYSTACK_INIT_MAX_RETRIES,
  PAYSTACK_INIT_RETRY_BASE_MS: process.env.PAYSTACK_INIT_RETRY_BASE_MS,
}

test.beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit"
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
  process.env.PAYSTACK_INIT_TIMEOUT_MS = "50"
  process.env.PAYSTACK_INIT_MAX_RETRIES = "1"
  process.env.PAYSTACK_INIT_RETRY_BASE_MS = "1"
})

test.afterEach(() => {
  global.fetch = originalFetch
})

test.after(() => {
  process.env.PAYSTACK_SECRET_KEY = originalEnv.PAYSTACK_SECRET_KEY
  process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL
  process.env.PAYSTACK_INIT_TIMEOUT_MS = originalEnv.PAYSTACK_INIT_TIMEOUT_MS
  process.env.PAYSTACK_INIT_MAX_RETRIES = originalEnv.PAYSTACK_INIT_MAX_RETRIES
  process.env.PAYSTACK_INIT_RETRY_BASE_MS = originalEnv.PAYSTACK_INIT_RETRY_BASE_MS
})

test("initializePaystackTransaction uses callback base URL override", async () => {
  let callbackUrl: string | null = null

  global.fetch = (async (_input, init) => {
    const payload = JSON.parse(String(init?.body)) as { callback_url?: string }
    callbackUrl = payload.callback_url ?? null
    return new Response(
      JSON.stringify({
        status: true,
        message: "ok",
        data: {
          authorization_url: "https://checkout.paystack.co/xyz",
          access_code: "access_123",
          reference: "ref_123",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch

  await initializePaystackTransaction(
    {
      email: "guest@example.com",
      amount: 10000,
      metadata: { bookingRequestId: "req_0" },
    },
    { callbackBaseUrl: "https://preview.example.com/" },
  )

  assert.equal(callbackUrl, "https://preview.example.com/payment-success")
})

test("initializePaystackTransaction retries transient network failure and succeeds", async () => {
  let attempts = 0
  global.fetch = (async () => {
    attempts += 1
    if (attempts === 1) {
      throw new TypeError("network down")
    }

    return new Response(
      JSON.stringify({
        status: true,
        message: "ok",
        data: {
          authorization_url: "https://checkout.paystack.co/xyz",
          access_code: "access_123",
          reference: "ref_123",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch

  const payment = await initializePaystackTransaction({
    email: "guest@example.com",
    amount: 10000,
    metadata: { bookingRequestId: "req_1" },
  })

  assert.equal(attempts, 2)
  assert.equal(payment.reference, "ref_123")
})

test("initializePaystackTransaction throws non-retryable error for invalid payload", async () => {
  let attempts = 0
  global.fetch = (async () => {
    attempts += 1
    return new Response(
      JSON.stringify({
        status: false,
        message: "Invalid email address",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch

  await assert.rejects(
    initializePaystackTransaction({
      email: "bad-email",
      amount: 10000,
      metadata: { bookingRequestId: "req_2" },
    }),
    (error: unknown) => error instanceof PaymentInitNonRetryableError,
  )

  assert.equal(attempts, 1)
})

test("initializePaystackTransaction throws timeout error after retry exhaustion", async () => {
  let attempts = 0
  global.fetch = (async () => {
    attempts += 1
    throw { name: "AbortError" }
  }) as typeof fetch

  await assert.rejects(
    initializePaystackTransaction({
      email: "guest@example.com",
      amount: 10000,
      metadata: { bookingRequestId: "req_3" },
    }),
    (error: unknown) => error instanceof PaymentInitTimeoutError,
  )

  assert.equal(attempts, 2)
})
