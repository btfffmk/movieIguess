import { dialog, escapeHTML as e, title } from './ui.js';
export async function openDownloads(item, season, episode, scope) {
  const { element, close } = dialog('Download options', `<p class="eyebrow">TAKE THE STORY WITH YOU</p><h2>${e(title(item))}</h2><p class="muted">${item.media_type === 'tv' ? `Season ${season} · Episode ${episode}` : 'Available download sources'}</p><div data-download-body role="status">Looking for available files…</div>`, scope);
  const controller = new AbortController();
  element.addEventListener('close', () => controller.abort());
  scope.onCleanup(() => controller.abort());
  const body = element.querySelector('[data-download-body]');
  const updates = new Map();
  try {
    const { downloadProvider } = await import('./download-provider.js');
    if (controller.signal.aborted || !element.isConnected) return;
    const sources = await downloadProvider.getSources({ tmdbId: item.id, type: item.media_type, title: title(item), season, episode }, {
      signal: controller.signal,
      onProgress(update) {
        if (!element.isConnected) return;
        updates.set(update.provider, update);
        body.innerHTML = [...updates.values()].map(p => `<div class="download-progress"><span>${e(p.provider)} · ${e(p.status)}</span><progress max="100" value="${Math.min(100, Math.max(0, Number(p.percentage) || 0))}"></progress></div>`).join('');
      }
    });
    if (!element.isConnected || controller.signal.aborted) return;
    const safe = sources.filter(source => { try { return ['http:', 'https:'].includes(new URL(source.url).protocol); } catch { return false; } });
    body.innerHTML = safe.length ? safe.map(source => `<a class="download-source" href="${e(source.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${e(source.label)}</strong><small>${e(source.meta)}</small></span><span>↗</span></a>`).join('') : '<p>No download files were found for this title.</p><button class="button" data-retry>Search again</button>';
    body.querySelector('[data-retry]')?.addEventListener('click', () => { close(); openDownloads(item, season, episode, scope); });
  } catch (error) {
    if (!element.isConnected || controller.signal.aborted) return;
    body.innerHTML = `<p>Download providers are unavailable. Please try again.</p><button class="button" data-retry>Try again</button>`;
    body.querySelector('[data-retry]').onclick = () => { close(); openDownloads(item, season, episode, scope); };
  }
}
