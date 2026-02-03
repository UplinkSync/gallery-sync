(function () {
  const TIP_CLASS = 'gallery-sync-tip';
  const OPEN_CLASS = 'gallery-sync-tip-open';
  const OPEN_DELAY = 120; // ms
  const CLOSE_DELAY = 120; // ms

  const openTimers = new WeakMap();
  const closeTimers = new WeakMap();

  function closeAll() {
    document.querySelectorAll('.' + OPEN_CLASS).forEach(el => el.classList.remove(OPEN_CLASS));
  }

  function toggleTip(el, forceOpen) {
    if (!el || !el.classList.contains(TIP_CLASS)) return;
    const open = typeof forceOpen === 'boolean' ? forceOpen : !el.classList.contains(OPEN_CLASS);
    if (open) {
      closeAll();
      el.classList.add(OPEN_CLASS);
    } else {
      el.classList.remove(OPEN_CLASS);
    }
  }

  function schedule(el, action) {
    if (!el) return;
    clearTimeout(openTimers.get(el));
    clearTimeout(closeTimers.get(el));

    if (action === 'open') {
      const t = setTimeout(() => toggleTip(el, true), OPEN_DELAY);
      openTimers.set(el, t);
    } else if (action === 'close') {
      const t = setTimeout(() => toggleTip(el, false), CLOSE_DELAY);
      closeTimers.set(el, t);
    }
  }

  function handlePointer(e) {
    // Don't show tooltips on checkbox clicks
    if (e.target.type === 'checkbox') {
      return;
    }
    
    const target = e.target.closest('.' + TIP_CLASS);
    if (!target) {
      closeAll();
      return;
    }
    
    // Don't toggle if clicking a checkbox
    if (target.type === 'checkbox') {
      return;
    }
    
    toggleTip(target, true);
  }

  function handleKey(e) {
    if (e.key === 'Escape') {
      closeAll();
      return;
    }
    const target = e.target.closest('.' + TIP_CLASS);
    if (!target) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTip(target);
    }
  }

  function init() {
    // Only on admin page
    const tips = document.querySelectorAll('.' + TIP_CLASS);
    if (!tips.length) return;

    // Add tabindex for keyboard focus if missing
    tips.forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      // Add RTL flag for CSS flips
      if (document.documentElement.dir === 'rtl') {
        el.classList.add('gallery-sync-tip-rtl');
      }
      // Mouse hover: open, closeAll on leave
      el.addEventListener('mouseenter', () => schedule(el, 'open'));
      el.addEventListener('mouseleave', () => schedule(el, 'close'));
      el.addEventListener('focus', () => schedule(el, 'open'));
      el.addEventListener('blur', () => schedule(el, 'close'));
    });

    // Touch/click opens one at a time
    document.addEventListener('click', handlePointer, { passive: true });
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
