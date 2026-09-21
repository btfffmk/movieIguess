// Retain the original keys so the rebrand never resets a library.
export const KEYS = { profiles: 'movieiguess.profiles.v1', active: 'movieiguess.activeProfile.v1', list: 'movieiguess.myList.v1', progress: 'movieiguess.watchProgress.v1', server: 'movieiguess.watchServer.v1' };
const memory = new Map();
export function read(key, fallback) {
  try { const raw = memory.has(key) ? memory.get(key) : globalThis.localStorage?.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
}
export function write(key, value) {
  const raw = JSON.stringify(value);
  try { globalThis.localStorage.setItem(key, raw); memory.delete(key); }
  catch { memory.set(key, raw); globalThis.dispatchEvent?.(new Event('nebula-storage-warning')); }
}
export function remove(key) {
  memory.set(key, null);
  try { globalThis.localStorage.removeItem(key); } catch { /* Session fallback. */ }
}
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const mediaKey = item => `${item.media_type === 'tv' || (!item.title && item.name) ? 'tv' : 'movie'}-${item.id}`;
export function library(profileId) {
  const value = record(read(KEYS.list, {}))[profileId];
  return (Array.isArray(value) ? value : Object.values(record(value))).filter(item => item && Number.isInteger(Number(item.id)) && Number(item.id) > 0);
}
export function toggleList(profileId, item) {
  const all = record(read(KEYS.list, {}));
  const items = library(profileId);
  const exists = items.some(saved => mediaKey(saved) === mediaKey(item));
  all[profileId] = exists ? items.filter(saved => mediaKey(saved) !== mediaKey(item)) : [{ ...item, favorite: false }, ...items];
  write(KEYS.list, all);
  return !exists;
}
export function toggleFavorite(profileId, item) {
  const all = record(read(KEYS.list, {}));
  const items = library(profileId);
  const saved = items.find(saved => mediaKey(saved) === mediaKey(item));
  if (saved) saved.favorite = !saved.favorite;
  else items.unshift({ ...item, favorite: true });
  all[profileId] = items;
  write(KEYS.list, all);
}
export function progress(profileId) {
  return Object.values(record(record(read(KEYS.progress, {}))[profileId])).filter(item => item && Number(item.id) > 0).sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
}
export function saveProgress(profileId, item, serverId) {
  const all = record(read(KEYS.progress, {}));
  all[profileId] = { ...record(all[profileId]), [mediaKey(item)]: { id: item.id, media_type: item.media_type, item, watchSeason: item.watchSeason || 1, watchEpisode: item.watchEpisode || 1, serverId, startedAt: Date.now(), updatedAt: Date.now() }};
  write(KEYS.progress, all);
}
export function removeProgress(profileId, item) {
  const all = record(read(KEYS.progress, {}));
  if (all[profileId]) delete all[profileId][mediaKey(item)];
  write(KEYS.progress, all);
}
export function selectedServer() {
  try { return memory.get(KEYS.server) ?? globalThis.localStorage?.getItem(KEYS.server); } catch { return null; }
}
export function selectServer(id) {
  try { globalThis.localStorage.setItem(KEYS.server, id); memory.delete(KEYS.server); }
  catch { memory.set(KEYS.server, id); }
}
