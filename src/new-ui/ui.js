import { titleRoute } from './router.js';
export const escapeHTML = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const title = item => item.title || item.name || 'Untitled';
export const year = item => (item.release_date || item.first_air_date || '').slice(0, 4);
export const image = (path, size = 'w500') => path && /^\/[a-zA-Z0-9._-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : '';
export const mark = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="currentColor"/><ellipse cx="20" cy="20" rx="20" ry="7" transform="rotate(-35 20 20)" stroke="currentColor" stroke-width="1.6"/></svg>`;
export const brand = `<a class="brand" href="#/home" aria-label="Nebula home">${mark}<span>nebula<span class="brand-dot">.</span></span></a>`;
export function card(item, extra = '') {
  const src = image(item.poster_path);
  return `<article class="card"><a href="${titleRoute(item)}" aria-label="View ${escapeHTML(title(item))}"><div class="poster">${src ? `<img src="${src}" loading="lazy" alt="" width="342" height="513">` : `<span class="poster-fallback">${mark}<span>${escapeHTML(title(item))}</span></span>`}<span class="card-open">↗</span>${item.vote_average > 0 ? `<span class="score">★ ${Number(item.vote_average).toFixed(1)}</span>` : ''}</div><h3>${escapeHTML(title(item))}</h3><p>${escapeHTML(year(item))}<span>·</span>${item.media_type === 'tv' ? 'Series' : 'Film'}</p></a>${extra}</article>`;
}
export function cards(items, grid = false) { return `<div class="${grid ? 'poster-grid' : 'rail'}">${items.map(item => card(item)).join('')}</div>`; }
export const skeletons = () => `<div class="rail" aria-label="Loading titles">${Array.from({ length: 6 }, () => '<div class="skeleton poster"></div>').join('')}</div>`;
export function errorState(container, error, retry) {
  container.innerHTML = `<div class="empty"><h2>Something went off course</h2><p>${escapeHTML(error.message || 'Please try again.')}</p><button class="button" data-retry>Try again</button></div>`;
  container.querySelector('[data-retry]').onclick = retry;
}
export function dialog(label, content, scope) {
  const previous = document.activeElement;
  const element = document.createElement('dialog');
  element.className = 'dialog';
  element.setAttribute('aria-label', label);
  element.innerHTML = `<button class="icon-button dialog-close" aria-label="Close dialog">×</button>${content}`;
  document.body.append(element);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    element.close(); element.remove();
    if (previous?.isConnected) previous.focus();
  };
  element.querySelector('.dialog-close').onclick = close;
  element.addEventListener('cancel', event => { event.preventDefault(); close(); });
  element.addEventListener('click', event => { if (event.target === element) { const r = element.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  element.addEventListener('close', () => { if (!closed) close(); });
  scope?.onCleanup(close);
  element.showModal();
  return { element, close };
}
let toastTimer;
export function toast(message) {
  let element = document.querySelector('[data-toast]');
  if (!element) { element = document.createElement('div'); element.dataset.toast = ''; element.className = 'toast'; element.setAttribute('role', 'status'); document.body.append(element); }
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
}
