import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, library, toggleList, toggleFavorite, progress, saveProgress, read, write } from '../src/new-ui/storage.js';
import { getProfiles, addProfile, setActiveProfile, getActiveProfileId, deleteProfile } from '../src/new-ui/profile-store.js';
import { allowed, certification, filterCatalogue } from '../src/new-ui/catalogue.js';
import { parseRoute, createScope } from '../src/new-ui/router.js';
import { WATCH_SERVERS, getWatchUrl } from '../src/new-ui/providers.js';
import { api } from '../src/new-ui/api.js';
let data;
beforeEach(() => {
  data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } });
});
test('existing array and keyed libraries retain favourites and isolate profiles', () => {
  data.set(KEYS.list, JSON.stringify({ a: [{ id: 42, title: 'Film', media_type: 'movie', favorite: true }], b: { 'tv-9': { id: 9, name: 'Series', media_type: 'tv' } } }));
  assert.equal(library('a')[0].favorite, true);
  assert.equal(library('b')[0].id, 9);
  toggleFavorite('b', library('b')[0]);
  assert.equal(library('b')[0].favorite, true);
  toggleList('b', library('b')[0]);
  assert.equal(library('b').length, 0);
  assert.equal(library('a')[0].favorite, true);
});
test('profile onboarding accepts name only and retains identity on reload', () => {
  const profile = addProfile({ name: '  Test  ' });
  assert.equal(profile.name, 'Test');
  assert.deepEqual(profile.favoriteTitles, []);
  setActiveProfile(profile.id);
  assert.equal(getActiveProfileId(), profile.id);
  assert.equal(getProfiles()[0].id, profile.id);
  for (let i = 0; i < 4; i++) addProfile({ name: `Profile ${i}` });
  assert.throws(() => addProfile({ name: 'Sixth' }), /five/);
});
test('deletion clears only that profile and its active session', () => {
  const a = addProfile({ name: 'A' }); const b = addProfile({ name: 'B' });
  setActiveProfile(a.id);
  toggleList(a.id, { id: 1, title: 'A' }); toggleList(b.id, { id: 2, title: 'B' });
  deleteProfile(a.id);
  assert.equal(getActiveProfileId(), null);
  assert.equal(library(a.id).length, 0);
  assert.equal(library(b.id).length, 1);
});
test('malformed storage and expired sessions are handled without crashing', () => {
  data.set(KEYS.profiles, '[null,42,{"id":"valid","name":"Test"}]');
  assert.equal(getProfiles().length, 1);
  data.set(KEYS.active, JSON.stringify({ profileId: 'valid', selectedAt: Date.now() - 6 * 60 * 60 * 1000 }));
  assert.equal(getActiveProfileId(), null);
  data.set(KEYS.list, '{bad'); assert.deepEqual(library('valid'), []);
});
test('watch history preserves old entries and writes episode/server without fake timestamps', () => {
  data.set(KEYS.progress, JSON.stringify({ a: { 'tv-9': { id: 9, media_type: 'tv', watchSeason: 2, watchEpisode: 5, startedAt: 100 } } }));
  assert.equal(progress('a')[0].watchEpisode, 5);
  saveProgress('a', { id: 9, media_type: 'tv', watchSeason: 3, watchEpisode: 2 }, 'vidfast');
  assert.equal(progress('a')[0].serverId, 'vidfast');
  assert.equal(progress('a')[0].watchSeason, 3);
  assert.equal(progress('a')[0].currentTime, undefined);
});
test('blocked storage still supports the current session', () => {
  globalThis.localStorage.setItem = () => { throw new Error('Quota'); };
  write('test.fallback', { saved: true });
  assert.deepEqual(read('test.fallback'), { saved: true });
});
test('kids policy requires a verified US certification and never invents ratings', () => {
  const movie = { id: 1, media_type: 'movie', release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG', type: 3 }] }] } };
  assert.equal(allowed(movie, true), true);
  assert.equal(allowed({ ...movie, adult: true }, true), false);
  assert.equal(allowed({ id: 2, media_type: 'tv' }, true), false);
  assert.equal(certification({ media_type: 'movie' }), '');
  for (const rating of ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA']) {
    assert.equal(allowed({ media_type: 'tv', content_ratings: { results: [{ iso_3166_1: 'US', rating }] } }, true), !['TV-14', 'TV-MA'].includes(rating));
  }
});
test('all countries and languages remain eligible for adult browsing', async () => {
  const result = await filterCatalogue([{ id: 1, title: 'Indian film', original_language: 'hi', origin_country: ['IN'] }], { kids: false });
  assert.equal(result.length, 1);
});
test('routes validate media IDs, decode queries, and preserve episode selection', () => {
  assert.deepEqual(parseRoute('#/watch/tv/9?s=2&e=5'), { view: 'watch', type: 'tv', id: 9, season: 2, episode: 5 });
  assert.equal(parseRoute('#/search?q=a%26b').query, 'a&b');
  for (const value of ['#/title/person/1', '#/title/movie/0', '#/title/movie/1/extra', '#/unknown']) assert.equal(parseRoute(value).view, 'missing');
});
test('all original playback adapters emit HTTPS URLs and validate IDs', () => {
  assert.equal(WATCH_SERVERS.length, 16);
  for (const server of WATCH_SERVERS) {
    for (const type of ['movie', 'tv']) assert.equal(new URL(getWatchUrl({ id: 123, media_type: type, watchSeason: 2, watchEpisode: 3 }, server.id)).protocol, 'https:');
  }
  assert.match(getWatchUrl({ id: 12, media_type: 'tv', watchSeason: 2, watchEpisode: 3 }, 'vidfast'), /\/tv\/12\/2\/3$/);
  assert.throws(() => getWatchUrl({ id: 'bad' }, 'vidfast'));
});
test('screen cleanup aborts once and disposes listeners/timers', () => {
  const scope = createScope(); let disposed = 0;
  scope.onCleanup(() => disposed++); scope.close(); scope.close();
  assert.equal(scope.signal.aborted, true); assert.equal(disposed, 1);
});
test('shared TMDB request survives one caller cancelling and caches successful results', async () => {
  const original = globalThis.fetch;
  let resolve, calls = 0;
  globalThis.fetch = () => { calls++; return new Promise(done => { resolve = () => done({ ok: true, json: async () => ({ results: [1] }) }); }); };
  try {
    const controller = new AbortController();
    const a = api('/test/shared', { signal: controller.signal });
    const b = api('/test/shared');
    controller.abort(); resolve();
    await assert.rejects(a, { name: 'AbortError' });
    assert.deepEqual(await b, { results: [1] });
    await api('/test/shared'); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
