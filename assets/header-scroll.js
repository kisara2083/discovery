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
    mobileDirectionThreshold: 6,
    mobileNearTop: 24,
    mobileHideFromY: 56
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
  let anchorY = Math.max(0, window.scrollY);
  let queued = false;
  const update = () => {
    queued = false;
    if (!syncScope()) { anchorY = Math.max(0, window.scrollY); return; }
    const y = Math.max(0, window.scrollY);
    const isMobile = window.matchMedia('(max-width:760px)').matches;
    const topLimit = isMobile ? SETTINGS.mobileNearTop : SETTINGS.nearTop;
    if (y <= topLimit || header.querySelector(':focus-visible')) {
      show(); anchorY = y; return;
    }
    const delta = y - anchorY;
    const minDelta = isMobile ? SETTINGS.mobileDirectionThreshold : SETTINGS.directionThreshold;
    if (Math.abs(delta) < minDelta) return;
    if (delta < 0) show();
    else if (y > (isMobile ? SETTINGS.mobileHideFromY : header.offsetHeight + SETTINGS.hideAfterHeader)) header.classList.add('is-header-hidden');
    anchorY = y;
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('hashchange', () => { anchorY = Math.max(0, window.scrollY); syncScope(); show(); });
  window.addEventListener('pageshow', () => { anchorY = Math.max(0, window.scrollY); syncScope(); show(); });
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
