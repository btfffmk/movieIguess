import { details } from './api.js';
import { allowed } from './catalogue.js';
import { WATCH_SERVERS, getWatchUrl } from './providers.js';
import { selectedServer, selectServer, saveProgress } from './storage.js';
import { escapeHTML as e, title } from './ui.js';
import { titleRoute, watchRoute } from './router.js';
import { episodePicker } from './episodes.js';
export async function mountPlayer(container, route, profile, scope) {
  container.innerHTML = '<div class="empty"><h1>Getting your story ready…</h1></div>';
  const item = await details(route.type, route.id, scope.signal);
  if (!scope.alive()) return;
  document.title = `Watch ${title(item)} · Nebula`;
  if (!allowed(item, profile.kids)) { container.innerHTML = '<div class="empty"><h1>This title is unavailable for this profile.</h1><a class="button" href="#/home">Back home</a></div>'; return; }
  let season = route.season, episode = route.episode;
  let server = WATCH_SERVERS.find(s => s.id === selectedServer()) || WATCH_SERVERS[0];
  container.innerHTML = `<div class="watch-page"><a class="back-link" href="${titleRoute(item)}">← Back to ${e(title(item))}</a><div class="watch-heading"><div><p class="eyebrow">NOW IN YOUR ORBIT</p><h1>${e(title(item))}</h1></div><label>Playback server<select data-server>${WATCH_SERVERS.map(s => `<option value="${s.id}" ${s.id === server.id ? 'selected' : ''}>${e(s.name)} · ${e(s.id)}</option>`).join('')}</select></label></div><div class="player-container" data-player><p>Preparing the player…</p></div><p class="muted">If this player is unavailable, choose another server above.</p><div data-episodes></div></div>`;
  const load = () => {
    if (!scope.alive() || !episode) return;
    const playing = { ...item, watchSeason: season, watchEpisode: episode };
    container.querySelector('[data-player]').innerHTML = `<iframe title="${e(title(item))} player" src="${e(getWatchUrl(playing, server.id))}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    saveProgress(profile.id, playing, server.id);
    const hash = watchRoute(item, season, episode);
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
  };
  container.querySelector('[data-server]').onchange = event => { server = WATCH_SERVERS.find(s => s.id === event.target.value); selectServer(server.id); load(); };
  if (item.media_type === 'tv') await episodePicker(container.querySelector('[data-episodes]'), item, scope, (s, ep) => { season = s; episode = ep; if (ep) load(); else container.querySelector('[data-player]').innerHTML = '<p>Choose an available episode to start watching.</p>'; }, season, episode);
  else load();
}
