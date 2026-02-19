import test from "node:test"
import assert from "node:assert/strict"
import { sanitizeText } from "../lib/security/sanitize"

test("sanitizeText trims, strips control chars, and truncates", () => {
  const value = " \nHello\u0000World\t\r "
  const result = sanitizeText(value, 8)

  assert.equal(result, "HelloWor")
})

test("sanitizeText keeps safe text intact", () => {
  const result = sanitizeText("Mabu Apartments", 100)
  assert.equal(result, "Mabu Apartments")
})
