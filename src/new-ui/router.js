export function parseRoute(hash = '') {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/');
  const params = new URLSearchParams(query);
  if (['title', 'watch'].includes(parts[0]) && ['movie', 'tv'].includes(parts[1]) && /^\d+$/.test(parts[2]) && Number.isSafeInteger(Number(parts[2])) && Number(parts[2]) > 0 && parts.length === 3) {
    return { view: parts[0], type: parts[1], id: Number(parts[2]), season: Math.max(1, parseInt(params.get('s')) || 1), episode: Math.max(1, parseInt(params.get('e')) || 1) };
  }
  if (['home', 'movies', 'series', 'list', 'search'].includes(path) || !path) return { view: path || 'home', query: params.get('q') || '' };
  return { view: 'missing' };
}
export const titleRoute = item => `#/title/${item.media_type}/${item.id}`;
export const watchRoute = (item, season = 1, episode = 1) => `#/watch/${item.media_type}/${item.id}?s=${season}&e=${episode}`;
export function createScope() {
  const controller = new AbortController();
  const callbacks = [];
  return { signal: controller.signal, alive: () => !controller.signal.aborted, onCleanup: fn => callbacks.push(fn), close: () => { controller.abort(); callbacks.splice(0).forEach(fn => fn()); } };
}
