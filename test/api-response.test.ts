import test from "node:test"
import assert from "node:assert/strict"
import { fail, ok } from "../lib/api/response"

test("ok returns expected status and payload", async () => {
  const response = ok({ success: true, value: 42 }, 201)
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.deepEqual(body, { success: true, value: 42 })
})

test("fail returns structured error payload", async () => {
  const response = fail("Invalid input", 400, "VALIDATION_ERROR", { field: "roomId" })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.deepEqual(body, {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: { field: "roomId" },
    },
  })
})
