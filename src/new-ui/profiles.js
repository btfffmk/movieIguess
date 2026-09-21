import { getProfiles, addProfile, updateProfile, deleteProfile, setActiveProfile } from './profile-store.js';
import { brand, dialog, escapeHTML as e, toast } from './ui.js';
import { api } from './api.js';
import { filterCatalogue } from './catalogue.js';
export function profileGate(container, scope, refresh) {
  const profiles = getProfiles();
  container.innerHTML = `<section class="profile-gate">${brand}<div class="gate-orbit" aria-hidden="true"></div><div class="gate-content"><p class="eyebrow">YOUR OWN LITTLE UNIVERSE</p><h1>Who's exploring?</h1><p class="muted">A world of stories. A space that's yours.</p><div class="profile-choices">${profiles.map(p => `<div><button class="profile-choice" data-profile="${e(p.id)}"><span class="avatar">${e(p.name.slice(0, 1).toUpperCase())}</span><strong>${e(p.name)}</strong><small>${p.kids ? 'Kids space' : 'Personal space'}</small></button><button class="text-button" data-edit="${e(p.id)}">Edit profile</button></div>`).join('')}${profiles.length < 5 ? '<button class="profile-choice add-profile" data-add><span class="avatar">+</span><strong>Add profile</strong><small>Make yourself at home</small></button>' : ''}</div><p class="gate-note">Your profiles and library stay in this browser.</p></div></section>`;
  container.querySelectorAll('[data-profile]').forEach(button => button.onclick = () => { setActiveProfile(button.dataset.profile); refresh(); });
  container.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editProfile(profiles.find(p => p.id === button.dataset.edit), scope, refresh));
  container.querySelector('[data-add]')?.addEventListener('click', () => editProfile(null, scope, refresh));
}
export function editProfile(profile, scope, refresh) {
  const { element, close } = dialog(profile ? 'Edit profile' : 'Create profile', `<p class="eyebrow">YOUR NEBULA</p><h2>${profile ? 'Make it yours' : 'A new space for you'}</h2><form class="profile-form"><label>Profile name<input name="name" maxlength="32" required autocomplete="off" value="${e(profile?.name || '')}" placeholder="Your name"></label><label class="check-label"><input type="checkbox" name="kids" ${profile?.kids ? 'checked' : ''}> Kids profile <small>Only titles with verified family ratings</small></label><details><summary>Favourite titles <span class="muted">· optional</span></summary><p class="muted">Choose a few stories you love to shape your recommendations.</p><input data-title-search aria-label="Find favourite titles" placeholder="Search for a favourite…"><div data-title-results></div><div class="selected-titles" data-selected></div></details><p class="form-error" role="status"></p><div class="actions"><button class="button primary" type="submit">${profile ? 'Save changes' : 'Create profile'}</button>${profile ? '<button class="button danger" type="button" data-delete>Delete profile</button>' : ''}</div></form>`, scope);
  const selected = new Map((profile?.favoriteTitles || []).map(value => [typeof value === 'string' ? value : `${value.media_type}-${value.id}`, value]));
  const labels = new Map();
  const paint = () => {
    element.querySelector('[data-selected]').innerHTML = [...selected].map(([key, value]) => `<button type="button" class="chip" data-remove="${e(key)}">${e(typeof value === 'object' ? value.title || value.name : labels.get(key) || 'Saved favourite')} ×</button>`).join('');
    element.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { selected.delete(button.dataset.remove); paint(); });
  };
  paint();
  const legacyController = new AbortController();
  scope.onCleanup(() => legacyController.abort());
  element.addEventListener('close', () => legacyController.abort());
  for (const [key, value] of selected) {
    const match = typeof value === 'string' && /^(movie|tv)-(\d+)$/.exec(value);
    if (match) api(`/${match[1]}/${match[2]}?language=en-US`, { signal: legacyController.signal }).then(item => {
      if (element.isConnected) { labels.set(key, item.title || item.name); paint(); }
    }).catch(() => {});
  }
  let timer, request;
  const cleanup = () => { clearTimeout(timer); request?.abort(); };
  element.addEventListener('close', cleanup);
  scope.onCleanup(cleanup);
  element.querySelector('[data-title-search]').oninput = event => {
    clearTimeout(timer); request?.abort();
    const term = event.target.value.trim();
    const target = element.querySelector('[data-title-results]');
    target.innerHTML = '';
    if (term.length < 2) return;
    timer = setTimeout(async () => {
      request = new AbortController();
      try {
        const response = await api(`/search/multi?include_adult=false&query=${encodeURIComponent(term)}`, { signal: request.signal });
        const items = await filterCatalogue(response.results.slice(0, 8), { kids: element.querySelector('[name=kids]').checked }, request.signal);
        if (!element.isConnected) return;
        target.innerHTML = items.map((item, index) => `<button class="search-option" type="button" data-pick="${index}">${e(item.title || item.name)}</button>`).join('');
        target.querySelectorAll('[data-pick]').forEach(button => button.onclick = () => { const item = items[button.dataset.pick]; selected.set(`${item.media_type}-${item.id}`, item); paint(); });
      } catch (error) { if (error.name !== 'AbortError') target.textContent = 'Search unavailable. You can add favourites later.'; }
    }, 300);
  };
  element.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    const patch = { name: form.get('name').trim(), kids: form.has('kids'), favoriteTitles: [...selected.values()] };
    try {
      if (profile) updateProfile(profile.id, patch); else { const created = addProfile(patch); setActiveProfile(created.id); }
      cleanup(); close(); refresh();
    } catch (error) { element.querySelector('.form-error').textContent = error.message; }
  };
  const deleteButton = element.querySelector('[data-delete]');
  if (deleteButton) deleteButton.onclick = () => {
    if (deleteButton.dataset.confirm) { deleteProfile(profile.id); close(); toast('Profile removed'); refresh(); }
    else { deleteButton.dataset.confirm = 'true'; deleteButton.textContent = 'Confirm deletion of profile and library'; }
  };
}
