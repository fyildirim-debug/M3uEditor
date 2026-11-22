/**
 * Kucuk, surec ici TTL + LRU onbellek.
 *
 * Ayni anahtar icin suren bir yukleme varsa ikinci cagri ona baglanir
 * (in-flight dedupe): oynaticilar ayni dizi bilgisini paralel istedigi icin
 * aksi halde saglayiciya ayni istek ust uste gidiyordu. Hata onbelleklenmez.
 */
class TtlCache {
  constructor({ ttlMs = 600_000, maxEntries = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.pending = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU: okunan anahtari sona tasi.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
    this.pending.clear();
  }

  async wrap(key, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value);
        return value;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, promise);
    return promise;
  }
}

module.exports = TtlCache;
