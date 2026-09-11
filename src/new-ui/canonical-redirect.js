(function() {
  if (!/^https?:$/.test(window.location.protocol)) {
    return;
  }

  const githubHost = 'btfffmk.github.io';
  const canonicalHost = 'nebula.btfm.uk';
  const githubProjectPath = '/movieIguess';
  const currentPath = window.location.pathname || '/';
  const isGithubPages = window.location.hostname.toLowerCase() === githubHost;
  const appPath = isGithubPages && currentPath.startsWith(githubProjectPath)
    ? currentPath.slice(githubProjectPath.length) || '/'
    : currentPath;
  const isHomePage = appPath === '/' || appPath === '/index.html';
  const targetOrigin = isGithubPages
    ? `https://${canonicalHost}`
    : window.location.origin;
  const targetPath = isHomePage && !isGithubPages ? appPath : '/';
  const targetUrl = `${targetOrigin}${targetPath}${window.location.search}${window.location.hash}`;
  const currentUrl = `${window.location.origin}${currentPath}${window.location.search}${window.location.hash}`;

  if (currentUrl !== targetUrl) {
    window.location.replace(targetUrl);
  }
})();
