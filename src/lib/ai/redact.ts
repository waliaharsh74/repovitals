const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /gsk_[A-Za-z0-9_-]{12,}/g,
  /(?<=api[_-]?key["'\s:=]+)[A-Za-z0-9._-]{12,}/gi,
  /(?<=authorization["'\s:=]+bearer\s+)[A-Za-z0-9._-]{12,}/gi,
];

export function redactApiKey(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);

  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[REDACTED]"),
    text ?? "",
  );
}
