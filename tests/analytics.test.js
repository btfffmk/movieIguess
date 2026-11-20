import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsRoute } from '../src/new-ui/analytics-route.js';
import { startAnalytics } from '../src/new-ui/analytics.js';
import worker from '../worker/index.js';

test('analytics routes use only fixed labels and remove all user input', () => {
  const cases = [
    ['#/search?q=private+phrase&token=secret', '#/search'],
    ['#/title/movie/123?profile=Alice', '#/title/movie/:id'],
    ['#/watch/tv/42?s=2&e=5', '#/watch/tv/:id'],
    ['/movie/42?utm_source=anything', '#/movie/:id'],
    ['#/home#private', '#/home'],
    ['#/profile/Alice', '#/unknown'],
    ['https://example.com/private', '#/unknown'],
    ['#/title/movie/123/secret', '#/unknown'],
    [null, '#/unknown'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(analyticsRoute(input), expected);
    assert.equal(analyticsRoute(expected), expected);
  }
});

test('browser sends only normalized route with cookies and referrer omitted', async () => {
  const saved = { fetch: globalThis.fetch, window: globalThis.window, location: globalThis.location };
  const calls = [];
  let onChange;
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error('offline'); };
  globalThis.window = { addEventListener: (event, callback) => { assert.equal(event, 'hashchange'); onChange = callback; } };
  globalThis.location = { hash: '#/search?q=private' };
  try {
    startAnalytics();
    globalThis.location.hash = '#/watch/movie/123';
    onChange();
    await Promise.resolve();
    assert.equal(calls.length, 2);
    for (const [url, options] of calls) {
      assert.equal(url, '/__nebula-analytics');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.referrerPolicy, 'no-referrer');
    }
    assert.deepEqual(JSON.parse(calls[0][1].body), { event: 'page_view', route: '#/search' });
    assert.deepEqual(JSON.parse(calls[1][1].body), { event: 'page_view', route: '#/watch/movie/:id' });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('Worker storage excludes sensitive headers, queries and extra payload fields', async () => {
  const points = [];
  const request = new Request('https://movies.btfm.uk/__nebula-analytics?token=secret', {
    method: 'POST', headers: { cookie: 'session=secret', authorization: 'Bearer secret', 'cf-connecting-ip': '192.0.2.1', referer: 'https://example.com/private' },
    body: JSON.stringify({ event: 'page_view', route: '#/watch/tv/42?s=2&e=5&q=private', profile: 'Alice', visitorId: 'secret' }),
  });
  request.cf = { country: 'GB', city: 'London' };
  const response = await worker.fetch(request, { NEBULA_ANALYTICS: { writeDataPoint: point => points.push(point) } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(points, [{ blobs: ['page_view', '#/watch/tv/:id', 'GB', 'movies.btfm.uk'], doubles: [1], indexes: ['movies.btfm.uk'] }]);
});

test('Worker rejects invalid events and maps arbitrary route/country to unknown', async () => {
  const points = [];
  const env = { NEBULA_ANALYTICS: { writeDataPoint: point => points.push(point) } };
  for (const body of ['{', 'null', '{}', '{"event":"private","route":"#/home"}']) {
    const response = await worker.fetch(new Request('https://movies.btfm.uk/__nebula-analytics', { method: 'POST', body }), env);
    assert.equal(response.status, 400);
  }
  assert.equal(points.length, 0);
  const request = new Request('https://movies.btfm.uk/__nebula-analytics', { method: 'POST', body: JSON.stringify({ event: 'page_view', route: '#/Alice/private' }) });
  request.cf = { country: 'private' };
  await worker.fetch(request, env);
  assert.deepEqual(points[0].blobs, ['page_view', '#/unknown', 'unknown', 'movies.btfm.uk']);
});

test('HTML operational log retains only event, country and status', async () => {
  const original = console.log;
  const logs = [];
  console.log = value => logs.push(JSON.parse(value));
  try {
    const request = new Request('https://movies.btfm.uk/movie/123?q=private', { headers: { accept: 'text/html', cookie: 'secret' } });
    request.cf = { country: 'GB' };
    const asset = new Response('page', { status: 200 });
    assert.equal(await worker.fetch(request, { ASSETS: { fetch: async () => asset } }), asset);
    assert.deepEqual(logs, [{ event: 'page_visit', country: 'GB', status: 200 }]);
  } finally { console.log = original; }
});

test('Worker rejects cross-site analytics writes and oversized bodies', async () => {
  const points = [];
  const env = { NEBULA_ANALYTICS: { writeDataPoint: point => points.push(point) } };
  const crossSite = new Request('https://movies.btfm.uk/__nebula-analytics', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', route: '#/home' }),
  });
  assert.equal((await worker.fetch(crossSite, env)).status, 403);
  const oversized = new Request('https://movies.btfm.uk/__nebula-analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', route: '#/home', padding: 'x'.repeat(600) }),
  });
  assert.equal((await worker.fetch(oversized, env)).status, 400);
  assert.equal(points.length, 0);
});
