import { details } from './api.js';
import { allowed, certification, filterCatalogue } from './catalogue.js';
import { library, mediaKey, progress, toggleList, toggleFavorite } from './storage.js';
import { escapeHTML as e, image, title, year, cards, dialog, toast } from './ui.js';
import { watchRoute } from './router.js';
import { episodePicker } from './episodes.js';
import { openDownloads } from './downloads.js';
export async function mountTitle(container, route, profile, scope) {
  container.innerHTML = '<div class="page-heading"><p class="eyebrow">OPENING A NEW WORLD</p><h1>One moment…</h1></div>';
  const item = await details(route.type, route.id, scope.signal);
  if (!scope.alive()) return;
  document.title = `${title(item)} · Nebula`;
  if (!allowed(item, profile.kids)) { container.innerHTML = '<div class="empty"><h1>This title is outside your space.</h1><p>This profile cannot open titles without an eligible rating.</p><a class="button" href="#/home">Back home</a></div>'; return; }
  const savedProgress = progress(profile.id).find(p => mediaKey(p) === mediaKey(item));
  let season = savedProgress?.watchSeason || 1, episode = savedProgress?.watchEpisode || 1;
  const backdrop = image(item.backdrop_path, 'original');
  const rating = certification(item);
  const runtime = item.runtime || item.episode_run_time?.[0];
  container.innerHTML = `<section class="title-hero">${backdrop ? `<img class="hero-image" src="${backdrop}" alt="">` : ''}<div class="hero-shade"></div><div class="title-content"><a class="back-link" href="#/home" data-back>← Back to exploring</a><p class="eyebrow">${item.media_type === 'tv' ? 'A SERIES TO GET LOST IN' : 'MAKE A NIGHT OF IT'}</p><h1>${e(title(item))}</h1><div class="title-meta">${e(year(item))}<span>${e(rating || 'Not rated')}</span>${runtime ? `<span>${runtime} min</span>` : ''}<span>${(item.genres || []).map(g => e(g.name)).join(' / ')}</span></div><p class="title-synopsis">${e(item.overview || 'A synopsis is not available yet.')}</p><div class="actions"><a class="button primary" data-play href="${watchRoute(item, season, episode)}">▶ ${savedProgress ? 'Continue watching' : 'Play now'}</a><button class="button glass" data-save></button><button class="button glass" data-favorite></button><button class="button glass" data-trailer>▷ Watch trailer</button></div></div></section><div class="content-wrap title-lower"><section><p class="eyebrow">${item.media_type === 'tv' ? 'THE NEXT CHAPTER' : 'YOUR EVENING, SORTED'}</p><h2>${item.media_type === 'tv' ? 'Choose your episode' : 'Settle in.'}</h2><div data-episodes></div><button class="text-button" data-download>↓ Download options</button><p class="fine-print">Continue Watching remembers your title and episode. Playback position depends on the selected player.</p></section><section><p class="eyebrow">THE PEOPLE BEHIND THE STORY</p><h2>Starring</h2><div class="cast">${(item.credits?.cast || []).slice(0, 6).map(actor => `<div>${image(actor.profile_path, 'w185') ? `<img src="${image(actor.profile_path, 'w185')}" alt="" loading="lazy">` : '<span class="cast-placeholder">○</span>'}<strong>${e(actor.name)}</strong><small>${e(actor.character)}</small></div>`).join('') || '<p class="muted">Cast information is unavailable.</p>'}</div></section></div><section class="collection content-wrap" data-related><p class="eyebrow">KEEP EXPLORING</p><h2>In a similar orbit</h2><div data-related-cards></div></section>`;
  container.querySelector('[data-back]').onclick = event => { if (history.state?.nebulaInternal) { event.preventDefault(); history.back(); } };
  const saveButton = container.querySelector('[data-save]');
  const favoriteButton = container.querySelector('[data-favorite]');
  const paintSave = () => {
    const saved = library(profile.id).find(i => mediaKey(i) === mediaKey(item));
    saveButton.textContent = saved ? '✓ In My List' : '+ My List';
    saveButton.setAttribute('aria-pressed', String(Boolean(saved)));
    favoriteButton.textContent = saved?.favorite ? '♥ Favourite' : '♡ Favourite';
    favoriteButton.setAttribute('aria-pressed', String(Boolean(saved?.favorite)));
  };
  paintSave();
  saveButton.onclick = () => { const added = toggleList(profile.id, item); paintSave(); toast(added ? 'Added to your universe' : 'Removed from My List'); };
  favoriteButton.onclick = () => { toggleFavorite(profile.id, item); paintSave(); };
  const trailer = (item.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer') || (item.videos?.results || []).find(v => v.site === 'YouTube');
  const trailerButton = container.querySelector('[data-trailer]');
  trailerButton.disabled = !trailer;
  if (!trailer) trailerButton.textContent = 'Trailer unavailable';
  trailerButton.onclick = () => dialog('Watch trailer', `<h2>${e(title(item))} — trailer</h2><iframe class="trailer-frame" title="${e(title(item))} trailer" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`, scope);
  const play = container.querySelector('[data-play]');
  const download = container.querySelector('[data-download]');
  download.onclick = () => openDownloads(item, season, episode, scope);
  if (item.media_type === 'tv') {
    await episodePicker(container.querySelector('[data-episodes]'), item, scope, (s, ep) => {
      season = s; episode = ep;
      play.setAttribute('aria-disabled', String(!ep));
      if (ep) play.href = watchRoute(item, s, ep); else play.removeAttribute('href');
      download.disabled = !ep;
    }, season, episode);
  }
  const related = await filterCatalogue(item.recommendations?.results || [], profile, scope.signal, item.media_type);
  if (!scope.alive()) return;
  if (related.length) container.querySelector('[data-related-cards]').innerHTML = cards(related);
  else container.querySelector('[data-related]').remove();
}
