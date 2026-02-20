import test from "node:test"
import assert from "node:assert/strict"
import { consumeOfficialIdUploadToken, issueOfficialIdUploadToken } from "../lib/security/upload-token"

const ORIGINAL_UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET

test.before(() => {
  process.env.UPLOAD_TOKEN_SECRET = "unit-test-upload-token-secret"
})

test.after(() => {
  process.env.UPLOAD_TOKEN_SECRET = ORIGINAL_UPLOAD_TOKEN_SECRET
})

test("upload token can be consumed once from the same IP", async () => {
  const ip = "203.0.113.10"
  const token = await issueOfficialIdUploadToken(ip, 60)

  const first = await consumeOfficialIdUploadToken(token, ip)
  assert.equal(first.valid, true)

  const second = await consumeOfficialIdUploadToken(token, ip)
  assert.equal(second.valid, false)
  assert.equal(second.reason, "replayed_or_unknown")
})

test("upload token rejects mismatched IP and remains usable for the right IP", async () => {
  const token = await issueOfficialIdUploadToken("203.0.113.20", 60)

  const wrongIpResult = await consumeOfficialIdUploadToken(token, "203.0.113.99")
  assert.equal(wrongIpResult.valid, false)
  assert.equal(wrongIpResult.reason, "ip_mismatch")

  const rightIpResult = await consumeOfficialIdUploadToken(token, "203.0.113.20")
  assert.equal(rightIpResult.valid, true)
})
