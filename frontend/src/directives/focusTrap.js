const SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default {
  mounted(element) {
    element.__previousFocus = document.activeElement
    const dialog = element.querySelector('.modal, .modal-content') || element
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
      const heading = dialog.querySelector('h1, h2, h3')
      dialog.setAttribute('aria-label', heading?.textContent?.trim() || 'İletişim penceresi')
    }
    element.__focusHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...element.querySelectorAll(SELECTOR)].filter(node => node.offsetParent !== null)
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    element.addEventListener('keydown', element.__focusHandler)
    requestAnimationFrame(() => (element.querySelector('[autofocus]') || element.querySelector(SELECTOR) || dialog).focus())
  },
  unmounted(element) {
    element.removeEventListener('keydown', element.__focusHandler)
    element.__previousFocus?.focus?.()
  },
}
