/* DISCOVERY header scroll direction behavior (phase 1).
 * Independent of background/parallax; edit SETTINGS or remove these two assets to revert. */
(() => {
  'use strict';
  const SETTINGS = Object.freeze({
    enabled: true,
    listingOnly: true,
    directionThreshold: 8,
    nearTop: 64,
    hideAfterHeader: 12,
    mobileDirectionThreshold: 3,
    mobileNearTop: 24,
    mobileHideFromY: 56,
    mobileRevealGesture: 14
  });
  const header = document.querySelector('body > header');
  if (!header || !SETTINGS.enabled) return;

  const active = () => !SETTINGS.listingOnly || !/^#article(?:\/|$)/.test(location.hash);
  const show = () => header.classList.remove('is-header-hidden');
  const syncScope = () => {
    const on = active();
    header.classList.toggle('discovery-scroll-header', on);
    if (!on) show();
    return on;
  };
  const mobile = window.matchMedia('(max-width:760px)');
  let touchPoint = null;
  let touchReturnRequested = false;
  let fingerDownTravel = 0;
  let anchorY = Math.max(0, window.scrollY);
  let queued = false;
  const update = () => {
    queued = false;
    if (!syncScope()) { anchorY = Math.max(0, window.scrollY); return; }
    const y = Math.max(0, window.scrollY);
    const isMobile = mobile.matches;
    const topLimit = isMobile ? SETTINGS.mobileNearTop : SETTINGS.nearTop;
    if (y <= topLimit || header.querySelector(':focus-visible')) {
      show(); anchorY = y; return;
    }
    // A deliberate upward swipe can begin before kinetic scrolling reverses.
    // Keep the header visible until the next deliberate downward swipe.
    if (isMobile && touchReturnRequested) { show(); anchorY = y; return; }
    const delta = y - anchorY;
    const minDelta = isMobile ? SETTINGS.mobileDirectionThreshold : SETTINGS.directionThreshold;
    if (isMobile) {
      // Browser toolbar expansion/collapse can perturb scrollY. Never treat it
      // as upward finger intent; only a confirmed touch gesture reveals us.
      if (delta >= minDelta && y > SETTINGS.mobileHideFromY) header.classList.add('is-header-hidden');
      anchorY = y;
      return;
    }
    if (Math.abs(delta) < minDelta) return;
    if (delta < 0) show();
    else if (y > header.offsetHeight + SETTINGS.hideAfterHeader) header.classList.add('is-header-hidden');
    anchorY = y;
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  // On touchscreens, respond to finger direction immediately rather than
  // waiting for momentum scrolling to reverse the window's scroll direction.
  window.addEventListener('touchstart', event => {
    if (!mobile.matches) return;
    const point = event.touches.length === 1 ? event.touches[0] : null;
    touchPoint = point ? { x: point.clientX, y: point.clientY } : null;
    touchReturnRequested = false;
    fingerDownTravel = 0;
  }, { passive: true });
  window.addEventListener('touchmove', event => {
    if (!mobile.matches || !touchPoint || event.touches.length !== 1 || !active()) return;
    const point = event.touches[0];
    const dx = point.clientX - touchPoint.x;
    const dy = point.clientY - touchPoint.y;
    touchPoint = { x: point.clientX, y: point.clientY };
    if (Math.abs(dy) < 2 || Math.abs(dy) <= Math.abs(dx)) return;
    fingerDownTravel = dy > 0 ? fingerDownTravel + dy : 0;
    if (fingerDownTravel >= SETTINGS.mobileRevealGesture) {
      touchReturnRequested = true;
      show();
      anchorY = Math.max(0, window.scrollY);
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { touchPoint = null; fingerDownTravel = 0; }, { passive: true });
  window.addEventListener('touchcancel', () => {
    touchPoint = null;
    touchReturnRequested = false;
    fingerDownTravel = 0;
  }, { passive: true });
  window.addEventListener('hashchange', () => { touchReturnRequested = false; anchorY = Math.max(0, window.scrollY); syncScope(); show(); });
  window.addEventListener('pageshow', () => { touchReturnRequested = false; anchorY = Math.max(0, window.scrollY); syncScope(); show(); });
  // Mobile browser chrome changes viewport height during a normal scroll.
  // Only a changed layout width (e.g. rotation) should reset the header.
  let layoutWidth = document.documentElement.clientWidth;
  window.addEventListener('resize', () => {
    const width = document.documentElement.clientWidth;
    if (width === layoutWidth) return;
    layoutWidth = width;
    anchorY = Math.max(0, window.scrollY);
    show();
  }, { passive: true });
  header.addEventListener('focusin', show);
  syncScope(); schedule();
})();
