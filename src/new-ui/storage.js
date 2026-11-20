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
const text = value => typeof value === 'string' ? value : '';
export const mediaKey = item => `${item.media_type === 'tv' || (!item.title && item.name) ? 'tv' : 'movie'}-${item.id}`;
// Catalogue cards stay small enough for localStorage. Playback metadata is not a TMDB payload.
export function libraryCard(item, favorite = item?.favorite === true) {
  const type = item?.media_type === 'tv' || (!item?.title && item?.name) ? 'tv' : 'movie';
  const card = {
    id: Number(item?.id),
    media_type: type,
    poster_path: text(item?.poster_path),
    backdrop_path: text(item?.backdrop_path),
    vote_average: Number(item?.vote_average) || 0,
    adult: item?.adult === true,
    favorite: favorite === true
  };
  if (type === 'tv') card.name = text(item?.name || item?.title);
  else card.title = text(item?.title || item?.name);
  if (item?.release_date) card.release_date = text(item.release_date);
  if (item?.first_air_date) card.first_air_date = text(item.first_air_date);
  return card;
}
export function library(profileId) {
  const value = record(read(KEYS.list, {}))[profileId];
  return (Array.isArray(value) ? value : Object.values(record(value))).filter(item => item && Number.isInteger(Number(item.id)) && Number(item.id) > 0);
}
export function toggleList(profileId, item) {
  const all = record(read(KEYS.list, {}));
  const items = library(profileId);
  const exists = items.some(saved => mediaKey(saved) === mediaKey(item));
  all[profileId] = exists ? items.filter(saved => mediaKey(saved) !== mediaKey(item)).map(saved => libraryCard(saved)) : [libraryCard(item, false), ...items.map(saved => libraryCard(saved))];
  write(KEYS.list, all);
  return !exists;
}
export function toggleFavorite(profileId, item) {
  const all = record(read(KEYS.list, {}));
  const items = library(profileId);
  const saved = items.find(entry => mediaKey(entry) === mediaKey(item));
  all[profileId] = saved
    ? items.map(entry => libraryCard(entry, mediaKey(entry) === mediaKey(item) ? entry.favorite !== true : entry.favorite === true))
    : [libraryCard(item, true), ...items.map(entry => libraryCard(entry))];
  write(KEYS.list, all);
}
export function progress(profileId) {
  return Object.values(record(record(read(KEYS.progress, {}))[profileId])).filter(item => item && Number(item.id) > 0).sort((a, b) => (b.updatedAt || b.startedAt || 0) - (a.updatedAt || a.startedAt || 0));
}
export function saveProgress(profileId, item, serverId) {
  const all = record(read(KEYS.progress, {}));
  const bucket = record(all[profileId]);
  const key = mediaKey(item);
  const previous = bucket[key];
  const next = {};
  for (const [entryKey, entry] of Object.entries(bucket)) {
    if (!entry || entryKey === key) continue;
    next[entryKey] = entry.item ? { ...entry, item: libraryCard(entry.item) } : entry;
  }
  next[key] = {
    id: Number(item.id),
    media_type: item.media_type === 'tv' ? 'tv' : 'movie',
    item: libraryCard(item),
    watchSeason: Math.max(1, Math.floor(Number(item.watchSeason) || 1)),
    watchEpisode: Math.max(1, Math.floor(Number(item.watchEpisode) || 1)),
    serverId: typeof serverId === 'string' ? serverId : '',
    startedAt: previous?.startedAt || Date.now(),
    updatedAt: Date.now()
  };
  all[profileId] = next;
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
