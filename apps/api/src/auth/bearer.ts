/** The token from an `Authorization: Bearer <token>` header, if that's what was sent. */
export function bearerToken(header: unknown): string | undefined {
  return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
}
