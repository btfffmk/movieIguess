import { KEYS, read, write, remove } from './storage.js';
export function getProfiles() {
  const value = read(KEYS.profiles, []);
  return (Array.isArray(value) ? value : [])
    .filter(p => p && typeof p.id === 'string' && p.id !== 'default' && typeof p.name === 'string')
    .map(p => ({ ...p, kids: p.kids === true, preferences: Array.isArray(p.preferences) ? p.preferences : [], favoriteTitles: Array.isArray(p.favoriteTitles) ? p.favoriteTitles : [] }));
}
export function saveProfiles(profiles) { write(KEYS.profiles, profiles); }
export function addProfile(profile) {
  const profiles = getProfiles();
  if (profiles.length >= 5) throw new Error('You can have up to five profiles.');
  if (!profile.name?.trim()) throw new Error('Enter a profile name.');
  const next = { ...profile, id: globalThis.crypto?.randomUUID?.() || 'profile-' + Date.now(), name: profile.name.trim(), color: profile.color || '#9b87f5', kids: Boolean(profile.kids), preferences: profile.preferences || [], favoriteTitles: profile.favoriteTitles || [] };
  saveProfiles([...profiles, next]);
  return next;
}
export function updateProfile(id, patch) {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Enter a profile name.');
  saveProfiles(getProfiles().map(p => p.id === id ? { ...p, ...patch, id } : p));
}
export function deleteProfile(id) {
  const active = getActiveProfileId();
  saveProfiles(getProfiles().filter(p => p.id !== id));
  for (const key of [KEYS.list, KEYS.progress]) {
    const data = read(key, {});
    if (data && typeof data === 'object') { delete data[id]; write(key, data); }
  }
  if (active === id) clearActiveProfile();
}
export function setActiveProfile(profileId) { write(KEYS.active, { profileId, selectedAt: Date.now() }); }
export function getActiveProfileSession() {
  const session = read(KEYS.active, null);
  const age = Date.now() - session?.selectedAt;
  if (!session || !Number.isFinite(age) || age < 0 || age >= 5 * 60 * 60 * 1000 || !getProfiles().some(p => p.id === session.profileId)) return null;
  return session;
}
export const getActiveProfileId = () => getActiveProfileSession()?.profileId || null;
export function clearActiveProfile() { remove(KEYS.active); }
