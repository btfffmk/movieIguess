import { details } from './api.js';
import { allowed } from './catalogue.js';
import { WATCH_SERVERS, createPlaybackCompletionGuard, getWatchUrl, resolveWatchServer } from './providers.js';
import { mediaKey, progress, selectServer, saveProgress, selectedServer } from './storage.js';
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
  const saved = progress(profile.id).find(entry => mediaKey(entry) === mediaKey(item));
  let server = resolveWatchServer(saved?.serverId, selectedServer());
  container.innerHTML = `<div class="watch-page"><a class="back-link" href="${titleRoute(item)}">← Back to ${e(title(item))}</a><div class="watch-heading"><div><p class="eyebrow">NOW IN YOUR ORBIT</p><h1>${e(title(item))}</h1></div></div><div class="player-container" data-player><p>Preparing the player…</p></div><div class="watch-server-controls"><label>Playback server<select data-server>${WATCH_SERVERS.map(s => `<option value="${s.id}" ${s.id === server.id ? 'selected' : ''}>${e(s.name)} · ${e(s.id === 'vidfast' ? 'Vidfast' : s.id)}</option>`).join('')}</select></label><p class="muted" data-playback-note></p></div><div data-episodes></div></div>`;
  const player = container.querySelector('[data-player]');
  const playbackNote = container.querySelector('[data-playback-note]');
  const completionGuard = createPlaybackCompletionGuard();
  let picker = null;
  let playerFrame = null;
  let playing = null;
  let playerLoad = 0;
  const updatePlaybackNote = () => {
    playbackNote.textContent = server.playbackEvents && item.media_type === 'tv'
      ? 'The next episode will start automatically when this one ends.'
      : 'Automatic next-episode playback is unavailable on this server. If playback is unavailable, try another server.';
  };
  const load = () => {
    if (!scope.alive() || !episode) return;
    playing = { ...item, watchSeason: season, watchEpisode: episode };
    playerLoad = completionGuard.beginLoad();
    player.innerHTML = `<iframe title="${e(title(item))} player" src="${e(getWatchUrl(playing, server.id))}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    playerFrame = player.querySelector('iframe');
    saveProgress(profile.id, playing, server.id);
    const hash = watchRoute(item, season, episode);
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
  };
  const onPlayerMessage = event => {
    if (!completionGuard.accept(playerLoad, server, event, playerFrame?.contentWindow, playing)) return;
    picker?.selectNext();
  };
  window.addEventListener('message', onPlayerMessage);
  scope.onCleanup(() => window.removeEventListener('message', onPlayerMessage));
  container.querySelector('[data-server]').onchange = event => {
    server = resolveWatchServer(event.target.value);
    selectServer(server.id);
    updatePlaybackNote();
    load();
  };
  updatePlaybackNote();
  if (item.media_type === 'tv') picker = await episodePicker(container.querySelector('[data-episodes]'), item, scope, (s, ep) => { season = s; episode = ep; if (ep) load(); else player.innerHTML = '<p>Choose an available episode to start watching.</p>'; }, season, episode);
  else load();
}
