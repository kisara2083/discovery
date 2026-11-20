/* DISCOVERY optional desktop micro-parallax.
 * Isolated from header/navigation, images, cards, and editorial data.
 * Set scrollRatio/maxTravelPx to tune. Remove this script to return to
 * the original fully fixed image (the CSS fallback offset is 0px).
 */
(() => {
  'use strict';
  const SETTINGS = Object.freeze({
    scrollRatio: 0.02,   // 2px movement per 100px of document scrolling
    maxTravelPx: 80     // wider travel; the 2% scrolling speed is unchanged
  });
  const motionAllowed = window.matchMedia(
    '(min-width:1181px) and (prefers-reduced-motion: no-preference)'
  );
  const root = document.documentElement;
  let frame = 0;
  let last = null;
  const update = () => {
    frame = 0;
    const active = motionAllowed.matches &&
      !!document.querySelector('#content > .grid');
    // Content moves up on a downward scroll: the background moves up too,
    // but only 2% as far. Scroll direction reversal moves it back naturally.
    const travel = active
      ? -Math.min(SETTINGS.maxTravelPx,
          Math.max(0, window.scrollY) * SETTINGS.scrollRatio)
      : 0;
    const next = travel.toFixed(2) + 'px';
    if (next === last) return;
    last = next;
    root.style.setProperty('--discovery-parallax-y', next);
  };
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', schedule);
  /* Mobile-only visual layer: generated on each list render, not on scroll.
   * The clipping wrapper is positioned absolutely; it never becomes a grid item. */
  const mobile = window.matchMedia('(max-width:760px)');
  const content = document.getElementById('content');
  const mountMobileBackdrop = () => {
    if (!mobile.matches || !content) return;
    const grid = content.querySelector(':scope > .grid');
    if (!grid || grid.querySelector(':scope > .discovery-mobile-backdrop')) return;
    const layer = document.createElement('div');
    layer.className = 'discovery-mobile-backdrop';
    layer.setAttribute('aria-hidden', 'true');
    const image = document.createElement('div');
    image.className = 'discovery-mobile-backdrop-image';
    layer.append(image);
    grid.prepend(layer);
  };
  if (content) new MutationObserver(mountMobileBackdrop)
    .observe(content, {childList:true});
  mobile.addEventListener?.('change', mountMobileBackdrop);
  mountMobileBackdrop();
  motionAllowed.addEventListener?.('change', schedule);
  schedule();
})();
