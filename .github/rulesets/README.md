# main dalı koruması

`main-protection.json`, GitHub'ın "Import a ruleset" özelliğiyle içe aktarılır:

**Settings → Rules → Rulesets → New ruleset ▾ → Import a ruleset** → bu dosyayı seçin → **Create**.

Kurallar:

- `main` silinemez ve üzerine zorla yazılamaz (force push yok).
- `main`'e değişiklik yalnızca pull request ile girer (onay sayısı 0: tek
  geliştirici kendi PR'ını birleştirebilir).
- Birleştirmeden önce CI'daki `verify` (testler, migration, audit) ve `images`
  (Docker imajları, `nginx -t`) işleri yeşil olmalı. Masaüstü paket işi yalnızca
  ilgili dosyalar değişince çalıştığı için zorunlu tutulmaz; aksi halde onu
  tetiklemeyen PR'lar sonsuza kadar beklerdi.
- Depo yöneticisi acil durumda kuralları yalnızca pull request üzerinden
  atlayabilir (`bypass_mode: pull_request`).

Komut satırından (yönetici yetkili bir `gh` oturumuyla):

```bash
gh api -X POST repos/fyildirim-debug/M3uEditor/rulesets --input .github/rulesets/main-protection.json
```
