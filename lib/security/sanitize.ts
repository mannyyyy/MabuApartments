function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "")
}

export function sanitizeText(value: string, maxLength: number) {
  return stripControlChars(value).trim().slice(0, maxLength)
}
