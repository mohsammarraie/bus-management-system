// Run before Angular and styles render. Keep the cookie contract aligned with the identity theme.
(() => {
  let preference = 'system';
  try {
    const saved = document.cookie
      .split('; ')
      .find((item) => item.startsWith('bus-management.appearance='))
      ?.split('=')[1];
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch {
    // Optional browser storage can be disabled.
  }
  document.documentElement.dataset.theme = preference;
})();
