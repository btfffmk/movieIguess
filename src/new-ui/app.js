import './canonical-redirect.js';
import './netflix-ui.css';
import { getProfiles, getActiveProfileId, clearActiveProfile } from './profile-store.js';
import { profileGate, editProfile } from './profiles.js';
import { parseRoute, createScope } from './router.js';
import { mountDiscovery } from './discovery.js';
import { mountTitle } from './title-page.js';
import { mountPlayer } from './player.js';
import { brand, escapeHTML as e, errorState, toast } from './ui.js';

const app = document.querySelector('#app');
let scope, shellProfile, currentHash = location.hash, searchTimer;
const positions = new Map();
history.scrollRestoration = 'manual';
function shell(profile) {
  app.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><header class="site-header">${brand}<nav aria-label="Main navigation">${[['home', 'Discover'], ['movies', 'Movies'], ['series', 'Series'], ['list', 'My List']].map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${label}</a>`).join('')}</nav><form class="site-search" role="search"><span aria-hidden="true">⌕</span><input name="q" aria-label="Search films and series" placeholder="Find your next story" autocomplete="off"><button type="submit" aria-label="Submit search">↵</button></form><div class="profile-control"><button class="avatar small" data-profile-menu aria-label="Profile menu for ${e(profile.name)}" aria-expanded="false">${e(profile.name.slice(0, 1).toUpperCase())}</button><div class="profile-menu" hidden><strong>${e(profile.name)}${profile.kids ? ' · Kids' : ''}</strong><button data-edit-profile>Edit profile</button><button data-switch-profile>Switch / manage profiles</button></div></div></header><main id="main" tabindex="-1"></main><footer><div>${brand}<p>A world of stories. A space that's yours.</p></div><div><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">Movie data by TMDB ↗</a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a href="https://ko-fi.com/christinex" target="_blank" rel="noopener noreferrer" data-support>Support</a><p>Made for the love of a good story.</p></div><span class="footer-note">YOUR PERSONAL UNIVERSE</span></footer>`;
  app.querySelector('.skip-link').onclick = event => { event.preventDefault(); app.querySelector('main').focus(); };
  const form = app.querySelector('.site-search');
  const input = form.querySelector('input');
  const submit = replace => {
    const hash = `#/search?q=${encodeURIComponent(input.value.trim())}`;
    clearTimeout(searchTimer);
    if (replace && parseRoute(location.hash).view === 'search') { history.replaceState(history.state, '', hash); render(); }
    else if (location.hash !== hash) location.hash = hash;
  };
  form.onsubmit = event => { event.preventDefault(); submit(false); };
  input.oninput = () => {
    clearTimeout(searchTimer);
    // Stop the previous search as soon as the query changes, not after debounce.
    if (parseRoute(location.hash).view === 'search') scope?.close();
    searchTimer = setTimeout(() => submit(true), 300);
  };
  const button = app.querySelector('[data-profile-menu]');
  const menu = app.querySelector('.profile-menu');
  button.onclick = () => { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); };
  app.querySelector('[data-edit-profile]').onclick = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); editProfile(profile, scope, refresh); };
  app.querySelector('[data-switch-profile]').onclick = () => { clearActiveProfile(); positions.clear(); refresh(); };
}
function refresh() { shellProfile = null; clearTimeout(searchTimer); render(); }
async function render() {
  const active = document.activeElement;
  const searching = active?.matches('.site-search input');
  positions.set(currentHash, window.scrollY);
  currentHash = location.hash;
  scope?.close();
  scope = createScope();
  const localScope = scope;
  const profile = getProfiles().find(p => p.id === getActiveProfileId());
  if (!profile) { shellProfile = null; profileGate(app, scope, refresh); return; }
  if (shellProfile !== profile.id) { shell(profile); shellProfile = profile.id; }
  const route = parseRoute(location.hash);
  const input = app.querySelector('.site-search input');
  if (!searching) input.value = route.view === 'search' ? route.query : '';
  app.querySelectorAll('[data-nav]').forEach(link => { if (link.dataset.nav === route.view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  const main = app.querySelector('main');
  if (!searching) main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  document.title = `${route.view === 'list' ? 'My List' : route.view === 'search' ? 'Search' : 'Discover'} · Nebula`;
  try {
    if (route.view === 'title') await mountTitle(main, route, profile, scope);
    else if (route.view === 'watch') await mountPlayer(main, route, profile, scope);
    else if (route.view === 'missing') main.innerHTML = '<div class="empty"><h1>A little lost in space?</h1><p>This page does not exist.</p><a class="button primary" href="#/home">Return home</a></div>';
    else await mountDiscovery(main, route, profile, scope);
    if (localScope.alive() && positions.has(currentHash)) window.scrollTo(0, positions.get(currentHash));
  } catch (error) { if (localScope.alive() && error.name !== 'AbortError') errorState(main, error, render); }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#/"]');
  if (link && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
    const hash = link.getAttribute('href');
    if (hash !== location.hash) {
      event.preventDefault(); clearTimeout(searchTimer);
      positions.set(location.hash, scrollY);
      history.pushState({ nebulaInternal: true }, '', hash); render();
    }
  }
  const control = app.querySelector('.profile-control');
  if (control && !control.contains(event.target)) { control.querySelector('.profile-menu').hidden = true; control.querySelector('button').setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement) { event.target.style.visibility = 'hidden'; event.target.parentElement?.classList.add('image-unavailable'); }
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { const menu = app.querySelector('.profile-menu'); if (menu && !menu.hidden) { menu.hidden = true; const button = app.querySelector('[data-profile-menu]'); button.setAttribute('aria-expanded', 'false'); button.focus(); } }
});
window.addEventListener('hashchange', render);
window.addEventListener('popstate', () => { /* hashchange renders hash-based history entries. */ });
window.addEventListener('nebula-storage-warning', () => toast('Browser storage is unavailable. Changes will last for this session only.'));
window.addEventListener('storage', refresh);
render();
