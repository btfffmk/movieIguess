import { api } from './api.js';
import { escapeHTML as e } from './ui.js';
export async function episodePicker(container, item, scope, onSelect, initialSeason = 1, initialEpisode = 1) {
  const seasons = (item.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
  if (!seasons.length) { container.innerHTML = '<p class="muted">Episode information is unavailable.</p>'; return; }
  let selectedSeason = seasons.some(s => s.season_number === initialSeason) ? initialSeason : seasons[0].season_number;
  let request = 0;
  container.innerHTML = `<div class="episode-controls"><label>Season<select data-season>${seasons.map(s => `<option value="${s.season_number}" ${s.season_number === selectedSeason ? 'selected' : ''}>${e(s.name || `Season ${s.season_number}`)}</option>`).join('')}</select></label><label>Episode<select data-episode disabled><option>Loading…</option></select></label></div><p class="muted episode-description" data-episode-description></p>`;
  const seasonInput = container.querySelector('[data-season]');
  const episodeInput = container.querySelector('[data-episode]');
  const description = container.querySelector('[data-episode-description]');
  let episodes = [];
  const notify = () => {
    const episode = episodes.find(ep => ep.episode_number === Number(episodeInput.value));
    description.textContent = episode?.overview || '';
    if (episode) onSelect(selectedSeason, episode.episode_number);
  };
  const load = async () => {
    const current = ++request;
    episodeInput.disabled = true;
    episodeInput.innerHTML = '<option>Loading…</option>';
    description.textContent = '';
    onSelect(selectedSeason, null);
    try {
      const response = await api(`/tv/${item.id}/season/${selectedSeason}?language=en-US`, { signal: scope.signal });
      if (!scope.alive() || current !== request) return;
      episodes = (response.episodes || []).filter(ep => ep.episode_number > 0);
      episodeInput.innerHTML = episodes.length ? episodes.map(ep => `<option value="${ep.episode_number}" ${ep.episode_number === initialEpisode ? 'selected' : ''}>${ep.episode_number}. ${e(ep.name)}</option>`).join('') : '<option>No episodes available</option>';
      episodeInput.disabled = !episodes.length;
      notify();
    } catch (error) {
      if (!scope.alive() || current !== request) return;
      episodeInput.innerHTML = '<option>Episodes unavailable</option>';
      description.innerHTML = '<button class="text-button" data-retry>Retry loading episodes</button>';
      description.querySelector('button').onclick = load;
    }
  };
  seasonInput.onchange = () => { selectedSeason = Number(seasonInput.value); initialEpisode = 1; load(); };
  episodeInput.onchange = notify;
  await load();
}
