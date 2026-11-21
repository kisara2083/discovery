/* Mobile-only backdrop mount. Desktop photo is immobile in CSS. */
(() => {
  'use strict';
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
})();
