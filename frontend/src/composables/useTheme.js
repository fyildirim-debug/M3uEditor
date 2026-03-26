import { ref } from 'vue'

const theme = ref(localStorage.getItem('app_theme') || 'system')

function applyTheme(t) {
  const root = document.documentElement
  if (t === 'light') {
    root.setAttribute('data-theme', 'light')
  } else if (t === 'dark') {
    root.setAttribute('data-theme', 'dark')
  } else {
    root.removeAttribute('data-theme')
  }
}

function setTheme(t) {
  theme.value = t
  localStorage.setItem('app_theme', t)
  applyTheme(t)
}

// Apply on load
applyTheme(theme.value)

export function useTheme() {
  return { theme, setTheme }
}
