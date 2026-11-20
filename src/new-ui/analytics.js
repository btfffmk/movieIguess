import { analyticsRoute } from './analytics-route.js';

const endpoint = '/__nebula-analytics';

function trackPageView() {
  fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', route: analyticsRoute(location.hash || '#/home') }),
  }).catch(() => {
    // Analytics must never affect browsing.
  });
}

export function startAnalytics() {
  trackPageView();
  window.addEventListener('hashchange', trackPageView);
}
