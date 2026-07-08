(function () {
  const storageKey = 'mawahib_theme';
  const fallback = 'emerald';
  const themes = ['emerald', 'indigo', 'rose', 'amber'];

  function readTheme() {
    try {
      const stored = localStorage.getItem(storageKey);
      return themes.includes(stored) ? stored : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function applyTheme(theme) {
    const nextTheme = themes.includes(theme) ? theme : fallback;
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {}
    window.dispatchEvent(new CustomEvent('mawahib:theme-change', { detail: { theme: nextTheme } }));
    return nextTheme;
  }

  window.PlatformTheme = {
    themes,
    get: readTheme,
    set: applyTheme,
    apply: applyTheme
  };

  applyTheme(readTheme());
})();