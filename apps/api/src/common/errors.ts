/** Message of a thrown value, whatever was thrown. */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
