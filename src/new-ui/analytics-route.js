// A closed vocabulary prevents unknown paths and user input becoming analytics labels.
export function analyticsRoute(value) {
  if (typeof value !== 'string') return '#/unknown';
  const path = value.replace(/^#/, '').split(/[?#]/, 1)[0];
  if (path === '' || path === '/') return '#/home';
  if (/^\/(home|movies|series|list|search)$/.test(path)) return '#' + path;
  const detail = path.match(/^\/(title|watch)\/(movie|tv)\/(?:[1-9]\d*|:id)$/);
  if (detail) return '#/' + detail[1] + '/' + detail[2] + '/:id';
  const movie = path.match(/^\/(movie|tv)\/(?:[1-9]\d*|:id)$/);
  if (movie) return '#/' + movie[1] + '/:id';
  return '#/unknown';
}
