type PaystackInitializePayload = {
  email: string
  amount: number
  metadata: Record<string, unknown>
  channels?: string[]
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

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured")
  }
  return secret
}

export async function initializePaystackTransaction(input: PaystackInitializePayload) {
  const callbackBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000"
  const callbackUrl = callbackBaseUrl.startsWith("http")
    ? `${callbackBaseUrl}/payment-success`
    : `https://${callbackBaseUrl}/payment-success`

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
  })

  const payload = (await response.json()) as PaystackInitializeResponse
  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message || "Paystack transaction initialization failed")
  }

  return payload.data
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
