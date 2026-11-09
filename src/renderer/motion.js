'use strict';
// Animate actual changes, never periodic state refreshes or the titlebar.
const uiMotion = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  let lastPage;
  const active = new Set();
  const enabled = () => !reduced.matches && !forced.matches && !document.hidden;
  function animate(element, frames, duration = 200) {
    if (!element || !enabled()) return;
    for (const effect of [...active]) if (effect.effect?.target === element) effect.cancel();
    const effect = element.animate(frames, { duration, easing: 'cubic-bezier(.2,0,0,1)' });
    active.add(effect);
    const done = () => active.delete(effect);
    effect.addEventListener('finish', done, { once: true });
    effect.addEventListener('cancel', done, { once: true });
    return effect;
  }
  function enter(element, distance = 6) {
    return animate(element, [{ opacity: .65, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }]);
  }
  const items = root => [...root.querySelectorAll('.folder-card,.rule-card,.history-card,.review-group')];
  function key(element) {
    const control = element.querySelector('[data-rule-id],[data-entry-id],[data-group-id]');
    return element.dataset.folderId || (control && (control.dataset.ruleId || control.dataset.entryId || control.dataset.groupId));
  }
  function capture(root) {
    return {
      items: new Set(items(root).map(key).filter(Boolean)),
      switches: new Map([...root.querySelectorAll('[role="switch"]')].map(el => [el.getAttribute('aria-label'), el.getAttribute('aria-checked')]))
    };
  }
  function rendered(root, page, previous) {
    const changed = lastPage !== page;
    lastPage = page;
    // Rerenders detach the previous nodes. Release their animation objects now.
    for (const effect of [...active]) if (!effect.effect?.target?.isConnected) effect.cancel();
    if (!enabled()) return;
    if (changed) enter(root);
    else {
      let count = 0;
      for (const item of items(root)) {
        if (key(item) && !previous.items.has(key(item)) && count++ < 8) enter(item, 4);
      }
      for (const control of root.querySelectorAll('[role="switch"]')) {
        const old = previous.switches.get(control.getAttribute('aria-label'));
        const current = control.getAttribute('aria-checked');
        if (old && old !== current) control.classList.add(current === 'true' ? 'motion-switch-on' : 'motion-switch-off');
      }
    }
  }
  function cancelIfNeeded() {
    if (enabled()) return;
    for (const effect of [...active]) effect.cancel();
    document.querySelectorAll('.motion-switch-on,.motion-switch-off').forEach(el => el.classList.remove('motion-switch-on', 'motion-switch-off'));
  }
  reduced.addEventListener('change', cancelIfNeeded);
  forced.addEventListener('change', cancelIfNeeded);
  document.addEventListener('visibilitychange', cancelIfNeeded);
  document.addEventListener('change', event => {
    if (event.target.matches('.preview-data input[type="checkbox"]') && event.target.checked) {
      animate(event.target.closest('tr'), [{ backgroundColor: '#78b9ff28' }, { backgroundColor: '#78b9ff0d' }], 180);
    }
  });
  return { capture, rendered, animate };
})();
