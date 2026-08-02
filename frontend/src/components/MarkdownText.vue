<template>
  <div class="md" v-html="html"></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ text: { type: String, default: '' } })

/**
 * Kucuk ve guvenli Markdown olusturucu.
 *
 * Once TUM girdi HTML olarak kacislanir, etiketler ancak ondan sonra bilinen
 * bicimlendirme kaliplarindan uretilir. Boylece modelin (ya da bir arac
 * ciktisinin) urettigi ham HTML hicbir zaman calistirilmaz.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(value) {
  return value
    // `kod`
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    // **kalın** ve __kalın__
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    // *italik* ve _italik_ (kalın işlendikten sonra)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    // ~~üstü çizili~~
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    // [metin](https://…) — yalnızca http(s) şemasına izin verilir
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function render(source) {
  const escaped = escapeHtml(source ?? '')
  const blocks = []
  // Önce ``` kod blokları ayrılır; içleri satır bazlı işlenmez.
  const parts = escaped.split(/```/)

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const body = part.replace(/^[a-zA-Z0-9_-]*\n/, '')
      blocks.push(`<pre><code>${body.replace(/\n$/, '')}</code></pre>`)
      return
    }

    let list = null
    const flush = () => {
      if (!list) return
      blocks.push(`<${list.tag}>${list.items.map((item) => `<li>${item}</li>`).join('')}</${list.tag}>`)
      list = null
    }

    for (const line of part.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) { flush(); continue }

      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
      if (heading) {
        flush()
        const level = Math.min(heading[1].length + 2, 6)
        blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`)
        continue
      }

      const bullet = trimmed.match(/^[-*+]\s+(.*)$/)
      if (bullet) {
        if (!list || list.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] } }
        list.items.push(inline(bullet[1]))
        continue
      }

      const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/)
      if (numbered) {
        if (!list || list.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] } }
        list.items.push(inline(numbered[1]))
        continue
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) { flush(); blocks.push('<hr />'); continue }

      const quote = trimmed.match(/^&gt;\s?(.*)$/)
      if (quote) { flush(); blocks.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue }

      flush()
      blocks.push(`<p>${inline(trimmed)}</p>`)
    }
    flush()
  })

  return blocks.join('')
}

const html = computed(() => render(props.text))
</script>

<style scoped>
.md { font-size: 13px; line-height: 1.55; word-break: break-word; }
.md :deep(p) { margin: 0 0 6px; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(strong) { font-weight: 700; color: var(--text-primary); }
.md :deep(em) { font-style: italic; }
.md :deep(del) { opacity: 0.65; }
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; padding: 1px 5px; border-radius: 4px;
  background: rgba(127, 127, 127, 0.16);
}
.md :deep(pre) {
  margin: 6px 0; padding: 9px 11px; border-radius: var(--radius-sm);
  background: rgba(127, 127, 127, 0.14); overflow-x: auto;
}
.md :deep(pre code) { background: none; padding: 0; font-size: 11.5px; line-height: 1.5; }
.md :deep(ul), .md :deep(ol) { margin: 4px 0 6px; padding-left: 20px; }
.md :deep(li) { margin: 2px 0; }
.md :deep(h3), .md :deep(h4), .md :deep(h5), .md :deep(h6) {
  margin: 8px 0 4px; font-size: 13.5px; font-weight: 700; color: var(--text-primary);
}
.md :deep(a) { color: var(--accent-hover); text-decoration: underline; }
.md :deep(blockquote) {
  margin: 6px 0; padding: 2px 0 2px 10px;
  border-left: 2px solid var(--border-light); color: var(--text-secondary);
}
.md :deep(hr) { border: none; border-top: 1px solid var(--border-light); margin: 8px 0; }
</style>
