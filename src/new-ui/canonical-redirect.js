(function () {
  if (location.hostname.toLowerCase() !== 'btfffmk.github.io') return;
  const prefix = '/movieIguess';
  if (location.pathname !== prefix && !location.pathname.startsWith(prefix + '/')) return;
  const path = location.pathname.slice(prefix.length) || '/';
  location.replace('https://nebula.btfm.uk' + path + location.search + location.hash);
})();
