import { api, details, normalize } from './api.js';
import { filterCatalogue } from './catalogue.js';
import { library, progress, mediaKey, removeProgress } from './storage.js';
import { cards, card, skeletons, escapeHTML as e, image, title, year, errorState } from './ui.js';
import { titleRoute, watchRoute } from './router.js';

const collections = [
  ['The animation studio', '/discover/movie?with_genres=16&sort_by=popularity.desc', 'movie'],
  ['A little more adrenaline', '/discover/movie?with_genres=28&sort_by=popularity.desc', 'movie'],
  ['Beyond the ordinary', '/discover/movie?with_genres=878&sort_by=popularity.desc', 'movie'],
  ['From Japan, with imagination', '/discover/tv?with_genres=16&with_origin_country=JP', 'tv'],
  ['Your next K-drama', '/discover/tv?with_origin_country=KR&sort_by=popularity.desc', 'tv']
];
function hero(item) {
  const backdrop = image(item.backdrop_path, 'original');
  return `<section class="hero">${backdrop ? `<img class="hero-image" src="${backdrop}" alt="" fetchpriority="high">` : ''}<div class="hero-shade"></div><div class="hero-content"><p class="eyebrow"><span class="live-dot"></span> IN YOUR ORBIT</p><div class="hero-meta">${item.media_type === 'tv' ? 'SERIES' : 'FILM'} <span>·</span> ${e(year(item))} ${item.vote_average ? `<span>·</span> ★ ${Number(item.vote_average).toFixed(1)}` : ''}</div><h1>${e(title(item))}</h1><p class="hero-description">${e(item.overview)}</p><div class="actions"><a class="button primary" href="${titleRoute(item)}">Explore title <span>↗</span></a><a class="button glass" href="${watchRoute(item)}">▶ Play now</a></div></div><div class="hero-index"><span>THE NEBULA SELECTION</span><span>01 <i>/</i> YOUR NEXT OBSESSION</span></div></section>`;
}
function section(label, id, subtitle = '') {
  return `<section class="collection" id="${id}"><div class="section-heading"><div><p class="eyebrow">${e(subtitle)}</p><h2>${e(label)}</h2></div><span class="rail-hint" aria-hidden="true">SCROLL TO EXPLORE →</span></div><div data-row>${skeletons()}</div></section>`;
}
async function loadCollection(target, path, type, profile, scope) {
  const response = await api(path, { signal: scope.signal });
  const items = await filterCatalogue(response.results || [], profile, scope.signal, type);
  if (scope.alive()) target.innerHTML = items.length ? cards(items) : '<p class="muted">No matching titles in this collection yet.</p>';
  return items;
}
export async function mountDiscovery(container, route, profile, scope) {
  if (route.view === 'list') return mountList(container, profile, scope);
  if (route.view === 'search') return mountSearch(container, route, profile, scope);
  const home = route.view === 'home';
  const type = route.view === 'series' ? 'tv' : 'movie';
  container.innerHTML = `${home ? '<div data-hero class="hero hero-loading"><div class="hero-content"><p class="eyebrow">WELCOME TO YOUR UNIVERSE</p><h1>Your next<br>great story.</h1><p class="muted">Finding something worth your evening.</p></div></div>' : `<header class="page-heading"><p class="eyebrow">EXPLORE THE NEBULA</p><h1>${type === 'tv' ? 'One more episode.' : 'Find your next favourite.'}</h1><p class="muted">${type === 'tv' ? 'Big worlds. Unforgettable characters. Your next obsession.' : 'From quiet discoveries to the films everyone is talking about.'}</p></header>`}<div class="content-wrap"><div data-continue></div><div data-personal></div>${section(home ? 'In the spotlight' : type === 'tv' ? 'Series everyone is watching' : 'Films everyone is watching', 'trending', 'WORTH YOUR TIME')}<div data-collections>${collections.filter(c => home || c[2] === type).map((c, i) => section(c[0], `collection-${i}`, 'GO A LITTLE FURTHER')).join('')}</div></div>`;
  const saved = progress(profile.id);
  if (saved.length) {
    const target = container.querySelector('[data-continue]');
    target.innerHTML = section('Pick up your story', 'continue', 'CONTINUE WATCHING');
    (async () => {
      const items = await Promise.all(saved.slice(0, 12).map(async entry => {
        const item = entry.item || await details(entry.media_type, entry.id, scope.signal);
        return { ...normalize(item, entry.media_type), watchSeason: entry.watchSeason || item.watchSeason || 1, watchEpisode: entry.watchEpisode || item.watchEpisode || 1 };
      }));
      const safe = await filterCatalogue(items, profile, scope.signal);
      if (!scope.alive()) return;
      if (!safe.length) { target.innerHTML = ''; return; }
      target.querySelector('[data-row]').innerHTML = `<div class="rail">${safe.map(item => card(item, `<div class="continue-actions"><a href="${watchRoute(item, item.watchSeason, item.watchEpisode)}">${item.media_type === 'tv' ? `Continue S${item.watchSeason} · E${item.watchEpisode}` : 'Watch again'} ↗</a><button data-remove="${e(mediaKey(item))}" aria-label="Remove ${e(title(item))} from Continue Watching">×</button></div>`)).join('')}</div>`;
      target.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { removeProgress(profile.id, safe.find(i => mediaKey(i) === button.dataset.remove)); button.closest('.card').remove(); if (!target.querySelector('.card')) target.innerHTML = ''; });
    })().catch(error => { if (scope.alive()) target.innerHTML = '<p class="muted">Your watch history is saved, but its details could not load. Refresh to retry.</p>'; });
  }
  const seeds = [...library(profile.id).filter(i => i.favorite), ...(profile.favoriteTitles || [])];
  const seed = seeds.map(value => {
    if (typeof value === 'object') return normalize(value);
    const match = /^(movie|tv)-(\d+)$/.exec(value);
    return match ? { media_type: match[1], id: match[2] } : null;
  }).find(Boolean);
  if (seed) {
    const target = container.querySelector('[data-personal]');
    target.innerHTML = section('Made for your orbit', 'personal', 'A LITTLE MORE YOU');
    loadCollection(target.querySelector('[data-row]'), `/${seed.media_type}/${seed.id}/recommendations`, seed.media_type, profile, scope).then(items => { if (scope.alive() && !items.length) target.innerHTML = ''; }).catch(() => { if (scope.alive()) target.innerHTML = ''; });
  }
  const path = profile.kids ? `/discover/${type}?with_genres=${type === 'tv' ? '10762' : '16,10751'}&include_adult=false` : `/trending/${home ? 'all' : type}/week`;
  const target = container.querySelector('#trending [data-row]');
  try {
    const items = await loadCollection(target, path, home && !profile.kids ? undefined : type, profile, scope);
    if (!scope.alive()) return;
    if (home) container.querySelector('[data-hero]').outerHTML = items.length ? hero(items.find(i => i.backdrop_path) || items[0]) : '<header class="page-heading"><h1>A quieter corner of the universe.</h1><p>No verified titles are available right now.</p></header>';
  } catch (error) {
    if (!scope.alive()) return;
    if (home) container.querySelector('[data-hero]').classList.add('hero-offline');
    errorState(target, error, () => mountDiscovery(container, route, profile, scope));
  }
  if (!scope.alive()) return;
  const rows = collections.filter(c => home || c[2] === type);
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    const index = Number(entry.target.id.split('-').pop());
    const [, path, rowType] = rows[index];
    const target = entry.target.querySelector('[data-row]');
    const load = () => loadCollection(target, path, rowType, profile, scope).catch(error => { if (scope.alive()) errorState(target, error, load); });
    load();
  }), { rootMargin: '400px' });
  container.querySelectorAll('[id^=collection-]').forEach(element => observer.observe(element));
  scope.onCleanup(() => observer.disconnect());
}
async function mountList(container, profile, scope) {
  container.innerHTML = '<header class="page-heading"><p class="eyebrow">SAVED FOR A GOOD EVENING</p><h1>Your little universe.</h1><p class="muted">All the stories you want to come back to.</p></header><div class="content-wrap" data-list></div>';
  const target = container.querySelector('[data-list]');
  target.innerHTML = skeletons();
  const items = await filterCatalogue(library(profile.id), profile, scope.signal);
  if (scope.alive()) target.innerHTML = items.length ? cards(items, true) : '<div class="empty"><h2>A universe of possibilities.</h2><p>Save a title and it will be right here when you need it.</p><a class="button primary" href="#/home">Find your next story ↗</a></div>';
}
async function mountSearch(container, route, profile, scope) {
  container.innerHTML = `<header class="page-heading"><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h1>${route.query ? `Results for “${e(route.query)}”` : 'What are you in the mood for?'}</h1></header><div class="content-wrap" data-results>${route.query ? skeletons() : '<p class="muted">Search for a film or series using the search bar above.</p>'}</div>`;
  if (!route.query.trim()) return;
  const target = container.querySelector('[data-results]');
  try {
    const result = await api(`/search/multi?include_adult=false&query=${encodeURIComponent(route.query)}`, { signal: scope.signal });
    const items = await filterCatalogue(result.results || [], profile, scope.signal);
    if (scope.alive()) target.innerHTML = items.length ? cards(items, true) : '<div class="empty"><h2>No stories found.</h2><p>Try another title or a shorter search.</p></div>';
  } catch (error) { if (scope.alive()) errorState(target, error, () => mountSearch(container, route, profile, scope)); }
}
