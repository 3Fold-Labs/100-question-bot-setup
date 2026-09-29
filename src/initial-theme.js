// Apply the saved or system theme before the page paints.
(function applyInitialTheme() {
  var theme = 'light';
  try {
    var saved = localStorage.getItem('bot-permissions-theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch {
    theme = 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
