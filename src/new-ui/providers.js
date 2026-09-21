export const WATCH_SERVERS = [
  {
    id: 'vidfast',
    name: 'Walter White',
    isNew: true,
    movie: id => `https://vidfast.vc/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidfast.vc/tv/${id}/${season}/${episode}`
  },
  {
    id: 'videasy',
    name: 'Michael Scofield',
    movie: id => `https://player.videasy.net/movie/${id}`,
    tv: (id, season, episode) =>
      `https://player.videasy.net/tv/${id}/${season}/${episode}`
  },
  {
    id: 'cinesrc',
    name: 'Dexter Morgan',
    isNew: true,
    movie: id => `https://cinesrc.st/embed/movie/${id}`,
    tv: id => `https://cinesrc.st/embed/tv/${id}`
  },
  {
    id: 'vidsrc1',
    name: 'Patrick Jane',
    movie: id => `https://www.vidsrc.wtf/api/1/movie?id=${id}`,
    tv: (id, season, episode) =>
      `https://www.vidsrc.wtf/api/1/tv?id=${id}&s=${season}&e=${episode}`
  },
  {
    id: 'vidsrc2',
    name: 'Jon Snow',
    movie: id => `https://vidsrc.wtf/api/2/movie?id=${id}`,
    tv: (id, season, episode) =>
      `https://vidsrc.wtf/api/2/tv?id=${id}&s=${season}&e=${episode}`
  },
  {
    id: 'premium',
    name: 'Eleven',
    movie: id => `https://111movies.com/movie/${id}`,
    tv: (id, season, episode) =>
      `https://111movies.com/tv/${id}/${season}/${episode}`
  },
  {
    id: 'vidsrc3',
    name: 'Rick Grimes',
    movie: id => `https://www.vidsrc.wtf/api/3/movie/?id=${id}`,
    tv: (id, season, episode) =>
      `https://www.vidsrc.wtf/api/3/tv/?id=${id}&s=${season}&e=${episode}`
  },
  {
    id: 'smashy',
    name: 'Sergio Marquina',
    movie: id => `https://smashyplayer.top/#mv${id}`,
    tv: (id, season, episode) =>
      `https://smashyplayer.top/#tv${id}s${season}e${episode}`
  },
  {
    id: 'vidlinkpro',
    name: 'Tommy Shelby',
    movie: id => `https://vidlink.pro/movie/${id}?autoplay=true&title=true`,
    tv: (id, season, episode) =>
      `https://vidlink.pro/tv/${id}/${season}/${episode}?autoplay=true&title=true`
  },
  {
    id: 'autoembed',
    name: 'Harry Potter',
    movie: id =>
      `https://test.autoembed.cc/embed/movie/${id}?autoplay=true&server=5`,
    tv: (id, season, episode) =>
      `https://test.autoembed.cc/embed/tv/${id}/${season}/${episode}?autoplay=true&server=5`
  },
  {
    id: 'multiembed',
    name: 'Frodo Baggins',
    movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, season, episode) =>
      `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
  },
  {
    id: 'primewire',
    name: 'Bruce Wayne',
    movie: id => `https://www.primewire.tf/embed/movie?tmdb=${id}`,
    tv: (id, season, episode) =>
      `https://www.primewire.tf/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
  },
  {
    id: 'vidrock',
    name: 'Joseph Cooper',
    movie: id => `https://vidrock.net/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidrock.net/tv/${id}/${season}/${episode}`
  },
  {
    id: 'mega',
    name: 'Jack Dawson',
    movie: id => `https://vidrock.net/mega/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidrock.net/mega/tv/${id}/${season}/${episode}`
  },
  {
    id: 'vidnest',
    name: 'Tony Stark',
    movie: id => `https://vidnest.fun/movie/${id}`,
    tv: (id, season, episode) =>
      `https://vidnest.fun/tv/${id}/${season}/${episode}`
  },
  {
    id: 'vidzee',
    name: 'Andy Dufresne',
    movie: id => `https://player.vidzee.wtf/embed/movie/${id}`,
    tv: (id, season, episode) =>
      `https://player.vidzee.wtf/embed/tv/${id}/${season}/${episode}`
  }
];
export function getWatchUrl(item, serverId) {
  const server = WATCH_SERVERS.find(server => server.id === serverId) || WATCH_SERVERS[0];
  const id = Number(item.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid title ID');
  const season = Math.max(1, Math.floor(Number(item.watchSeason) || 1));
  const episode = Math.max(1, Math.floor(Number(item.watchEpisode) || 1));
  return item.media_type === 'tv' ? server.tv(id, season, episode) : server.movie(id);
}
