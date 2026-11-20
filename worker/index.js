import { analyticsRoute } from '../src/new-ui/analytics-route.js';

const recentHits = new Map();

function country(request) {
  const value = request.cf?.country;
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : 'unknown';
}

function sameOriginWrite(request) {
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

// Best-effort burst limit inside this isolate. The address is not stored or logged.
function withinRateLimit(request) {
  const key = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const recent = (recentHits.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 240) {
    recentHits.set(key, recent);
    return false;
  }
  recent.push(now);
  recentHits.set(key, recent);
  if (recentHits.size > 5000) recentHits.clear();
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/__nebula-analytics' && request.method === 'POST') {
      if (!sameOriginWrite(request)) return new Response(null, { status: 403 });
      if (!withinRateLimit(request)) return new Response(null, { status: 429 });
      const declared = Number(request.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > 512) return new Response(null, { status: 400 });
      let payload;
      try {
        const raw = await request.text();
        if (raw.length > 512) return new Response(null, { status: 400 });
        payload = JSON.parse(raw);
      } catch {
        return new Response(null, { status: 400 });
      }
      if (payload?.event !== 'page_view' || typeof payload.route !== 'string') {
        return new Response(null, { status: 400 });
      }
      // Re-sanitize at the storage boundary, including requests from older clients.
      env.NEBULA_ANALYTICS.writeDataPoint({
        blobs: ['page_view', analyticsRoute(payload.route), country(request), url.hostname],
        doubles: [1],
        indexes: [url.hostname],
      });
      return new Response(null, { status: 204 });
    }

    const response = await env.ASSETS.fetch(request);
    // Only broad traffic information; never log the request or its headers/URL.
    if (request.headers.get('accept')?.includes('text/html')) {
      console.log(JSON.stringify({
        event: 'page_visit',
        country: country(request),
        status: response.status,
      }));
    }
    return response;
  },
};
