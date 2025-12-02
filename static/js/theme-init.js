// Apply theme ASAP to avoid flash
;(function () {
  try {
    var m = localStorage.getItem('theme')
    var dark =
      m === 'dark' ||
      (m !== 'light' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    // Toggle hljs themes if present
    window.__applyHljsTheme = function (dark) {
      var lightLink = document.getElementById('hljs-light')
      var darkLink = document.getElementById('hljs-dark')
      if (lightLink && darkLink) {
        lightLink.disabled = !!dark
        darkLink.disabled = !dark
      }
    }
    // Links exist above, so this applies immediately
    window.__applyHljsTheme(dark)
    // Listen for theme changes from app code
    window.addEventListener('theme-change', function (e) {
      var mode = e && e.detail && e.detail.mode
      var isDark =
        mode === 'dark' ||
        (mode === 'system' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      window.__applyHljsTheme(isDark)
    })
  } catch {}
})()
