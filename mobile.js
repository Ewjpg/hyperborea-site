(() => {
  'use strict';
  const viewport = window.visualViewport;
  if (!viewport) return;
  let frame = 0;
  function resize() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Do not interfere with pinch-to-zoom accessibility.
      if (viewport.scale > 1.05) return;
      document.documentElement.style.setProperty('--app-height', Math.round(viewport.height) + 'px');
      const field = document.activeElement;
      if (!field?.matches('textarea,input[type="number"],#fearSender,#wahSender,#wahPosition,#frogPosition,#swarggyPosition')) return;
      const bounds = field.getBoundingClientRect();
      const database = document.getElementById('database');
      const top = database.querySelector('.db-header').getBoundingClientRect().bottom + 12;
      // Keep the caret area reachable when the software keyboard opens.
      if (bounds.top < top) database.scrollTop += bounds.top - top;
      else if (bounds.top > viewport.height - 80) database.scrollTop += bounds.top - viewport.height + 110;
    });
  }
  viewport.addEventListener('resize', resize, {passive:true});
  window.addEventListener('orientationchange', resize, {passive:true});
  document.addEventListener('focusin', resize);
  document.addEventListener('focusout', resize);
  resize();
  const hint = document.getElementById('connectionHint');
  if (matchMedia('(pointer:coarse)').matches) hint.textContent = '[ TAP TO CONNECT ]';
})();

