import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadProvider } from '../src/new-ui/download-provider.js';
const media = { tmdbId: 10, type: 'tv', season: 2, episode: 3, title: 'Example' };
test('download SSE preserves split events, progress, deduplication and quality ordering', async () => {
  const previous = globalThis.fetch;
  const updates = [];
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    const payload = 'event: update\ndata: {"percentage":50,"status":"pending"}\n\nevent: completed\ndata: ' + JSON.stringify({ stream: [{ id: 'file', type: 'file', qualities: { '720p': { url: 'https://example.com/720' }, '1080p': { url: 'https://example.com/1080' } } }] }) + '\n\n';
    const bytes = new TextEncoder().encode(payload);
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, 35)); controller.enqueue(bytes.slice(35)); controller.close(); } }));
  };
  try {
    const sources = await downloadProvider.getSources(media, { onProgress: update => updates.push(update) });
    assert.equal(sources.length, 2);
    assert.equal(sources[0].quality, '1080p');
    assert.ok(updates.some(update => update.percentage === 50));
    assert.ok(urls.every(url => new URL(url).searchParams.get('episode') === '3'));
  } finally { globalThis.fetch = previous; }
});
test('empty sources differ from total provider failure and cancellation', async () => {
  const previous = globalThis.fetch;
  const warn = console.warn;
  console.warn = () => {};
  try {
    globalThis.fetch = async () => new Response('event: completed\ndata: {"stream":[]}\n\n');
    assert.deepEqual(await downloadProvider.getSources(media), []);
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(downloadProvider.getSources(media), /All download providers/);
    globalThis.fetch = async (_, { signal }) => { signal.throwIfAborted(); };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(downloadProvider.getSources(media, { signal: controller.signal }), { name: 'AbortError' });
  } finally { globalThis.fetch = previous; console.warn = warn; }
});
