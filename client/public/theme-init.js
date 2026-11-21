// Set the theme before the page draws, so dark mode does not flash white.
// A separate file (not inline) so the server's security policy can allow it.
try {
  var t = localStorage.getItem('theme') || 'system'
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch (e) {
  // storage blocked: the app sets the theme once it loads
}
