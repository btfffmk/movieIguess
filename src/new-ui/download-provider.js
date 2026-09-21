const DOWNLOAD_API = 'https://hahaevilcraft.site';
const DOWNLOAD_PROVIDERS = ['4khdhubnew', '4khdhub'];

function parseSSEBlock(block) {
  let event = 'message';
  const data = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;

    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (!data.length) return null;

  return {
    event,
    data: data.join('\n')
  };
}

function getFilenameFromContentDisposition(value) {
  const header = String(value || '');
  const encodedFilename = header.match(/filename\*=([^;]+)/i)?.[1];
  const filename = encodedFilename || header.match(/filename="?([^";]+)"?/i)?.[1];

  if (!filename) return '';

  try {
    return decodeURIComponent(filename.replace(/^UTF-8''/i, '')).trim();
  } catch {
    return filename.trim();
  }
}

function getFileExtension(url) {
  try {
    const parsedUrl = new URL(url);
    const disposition = parsedUrl.searchParams.get('response-content-disposition');
    const filename = getFilenameFromContentDisposition(disposition);
    const extension = filename.match(/\.([a-z0-9]{2,5})$/i)?.[1];

    return extension ? extension.toUpperCase() : '';
  } catch {
    return '';
  }
}

async function scrapeProvider(providerId, media, onProgress, signal) {
  const params = new URLSearchParams({
    id: providerId,
    tmdbId: String(media.tmdbId),
    type: media.type,
    title: media.title || '',
    _cb: String(Date.now())
  });

  if (media.type === 'tv') {
    if (media.season != null) params.set('season', String(media.season));
    if (media.episode != null) params.set('episode', String(media.episode));
  }

  const response = await fetch(
    `${DOWNLOAD_API}/scrape/source?${params.toString()}`,
    {
      method: 'GET',
      signal,
      headers: {
        Accept: 'text/event-stream'
      },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error(`${providerId} failed with HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error(`${providerId} returned no response stream`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = null;

  const processBlock = block => {
    const parsed = parseSSEBlock(block);
    if (!parsed) return;

    if (parsed.event === 'error') throw new Error(`${providerId} could not find sources`);

    if (parsed.event === 'start') {
      onProgress?.({
        provider: providerId,
        percentage: 0,
        status: 'pending'
      });
      return;
    }

    if (parsed.event === 'update') {
      try {
        const update = JSON.parse(parsed.data);
        onProgress?.({
          provider: providerId,
          percentage: Number(update.percentage || 0),
          status: update.status || 'pending'
        });
      } catch (error) {
        console.warn(`Invalid ${providerId} update event`, error);
      }
      return;
    }

    if (parsed.event === 'completed') {
      completed = JSON.parse(parsed.data);
      onProgress?.({
        provider: providerId,
        percentage: 100,
        status: 'success'
      });
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (block.trim()) processBlock(block);
      }
      if (completed) break;
    }

    buffer += decoder.decode();
    if (buffer.trim()) processBlock(buffer);

  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return completed || { embeds: [], stream: [] };
}

function normalizeStreams(data, providerId) {
  const results = [];
  const streams = Array.isArray(data?.stream) ? data.stream : [];

  for (const stream of streams) {
    if (stream?.type !== 'file') continue;

    for (const [quality, qualityInfo] of Object.entries(stream.qualities || {})) {
      if (!qualityInfo?.url) continue;

      const flags = Array.isArray(stream.flags) ? stream.flags : [];
      const sourceMode = flags.includes('ip-locked')
        ? 'Proxy'
        : flags.includes('cors-allowed')
          ? 'Direct'
          : 'Source';

      const format = getFileExtension(qualityInfo.url) || String(qualityInfo.type || 'file').toUpperCase();

      results.push({
        id: stream.id,
        provider: providerId,
        quality,
        format,
        sourceMode,
        flags,
        headers: stream.headers || {},
        captions: Array.isArray(stream.captions) ? stream.captions : [],
        url: qualityInfo.url,
        label: `${quality} · ${format}`,
        meta: `${providerId} · ${sourceMode}`
      });
    }
  }

  return results;
}

function dedupeSources(sources) {
  const seen = new Set();

  return sources.filter(source => {
    if (!source?.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function qualityScore(value) {
  const match = String(value || '').match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

export const downloadProvider = {
  async getSources(media, options = {}) {
    const onProgress = options.onProgress;
    let failures = 0;
    const timeout = AbortSignal.timeout(60000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    const jobs = DOWNLOAD_PROVIDERS.map(async providerId => {
      try {
        const data = await scrapeProvider(providerId, media, onProgress, signal);
        return normalizeStreams(data, providerId);
      } catch (error) {
        if (signal.aborted) throw error;
        failures++;
        console.warn(`Download provider ${providerId} failed:`, error);
        onProgress?.({
          provider: providerId,
          percentage: 100,
          status: 'error'
        });
        return [];
      }
    });

    const settled = await Promise.all(jobs);

    if (failures === DOWNLOAD_PROVIDERS.length) throw new Error('All download providers are unavailable');
    return dedupeSources(settled.flat()).sort((a, b) => {
      const qualityDifference = qualityScore(b.quality) - qualityScore(a.quality);
      if (qualityDifference) return qualityDifference;
      return a.provider.localeCompare(b.provider);
    });
  }
};

// Compatibility for external adapters following the original contract.
if (typeof window !== 'undefined') window.MovieIGuessDownloadProvider = downloadProvider;
