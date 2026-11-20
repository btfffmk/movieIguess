import { API_KEY, TMDB_API } from './config.js';
const cache = new Map();
const pending = new Map();
// Shared fetches are cancelled only when their last reader leaves.
export function api(path, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (cache.has(path)) return Promise.resolve(cache.get(path));
  let entry = pending.get(path);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, readers: 0 };
    const timeout = setTimeout(() => controller.abort(new Error('TMDB took too long to respond. Please try again.')), 20000);
    const url = new URL(TMDB_API + path);
    url.searchParams.set('api_key', import.meta.env?.VITE_TMDB_API_KEY || API_KEY);
    entry.promise = fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`TMDB is unavailable (${response.status}). Please try again.`);
      const data = await response.json();
      cache.set(path, data);
      if (cache.size > 400) cache.delete(cache.keys().next().value);
      return data;
    }).finally(() => { clearTimeout(timeout); if (pending.get(path) === entry) pending.delete(path); });
    pending.set(path, entry);
  }
  entry.readers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (fn, value) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener('abort', abort);
      entry.readers--;
      if (!entry.readers && pending.get(path) === entry) { pending.delete(path); entry.controller.abort(); }
      fn(value);
    };
    const abort = () => finish(reject, new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    entry.promise.then(value => finish(resolve, value), error => finish(reject, error));
  });
}
export const typeOf = item => item.media_type || (item.title ? 'movie' : 'tv');
export const normalize = (item, type) => ({ ...item, media_type: type || typeOf(item) });
export async function details(type, id, signal) {
  return normalize(await api(`/${type}/${id}?append_to_response=credits,videos,release_dates,content_ratings,recommendations&language=en-US`, { signal }), type);
}
