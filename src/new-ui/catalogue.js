import { details, normalize } from './api.js';
const MOVIE_RATINGS = new Set(['G', 'PG']);
const TV_RATINGS = new Set(['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG']);
export function certification(item) {
  if (item.media_type === 'tv') return item.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating || '';
  const releases = item.release_dates?.results?.find(r => r.iso_3166_1 === 'US')?.release_dates || [];
  return [...releases].sort((a, b) => Number(b.type === 3) - Number(a.type === 3)).find(r => r.certification)?.certification || '';
}
export function allowed(item, kids = false) {
  if (!item || item.adult || !['movie', 'tv'].includes(item.media_type)) return false;
  return !kids || (item.media_type === 'tv' ? TV_RATINGS : MOVIE_RATINGS).has(certification(item));
}
export async function filterCatalogue(items, profile, signal, type) {
  const normalized = items.filter(i => i && i.media_type !== 'person').map(i => normalize(i, type));
  if (!profile.kids) return normalized.filter(i => allowed(i));
  const result = new Array(normalized.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, normalized.length) }, async () => {
    while (index < normalized.length && !signal?.aborted) {
      const position = index++;
      const item = normalized[position];
      try {
        const full = await details(item.media_type, item.id, signal);
        if (allowed(full, true)) result[position] = { ...item, ...full };
      } catch (error) { if (error.name === 'AbortError') throw error; }
    }
  }));
  return result.filter(Boolean);
}
