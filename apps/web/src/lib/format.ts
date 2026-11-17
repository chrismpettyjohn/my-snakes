export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ago(iso: string | Date | null | undefined) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function since(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});

export const subtitle = (a: {species: string | null; morph: string | null}) => [a.species, a.morph].filter(Boolean).join(' · ');
