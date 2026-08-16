import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/logos': 'http://localhost:3000',
      // Xtream istemcileri katalog yollarini sunucu kokunde bekler. Uretimde
      // frontend/nginx.conf ayni yollari api'ye yonlendiriyor; dev sunucusu
      // bunlari proxy'lemezse player_api.php'ye index.html doner ve
      // oynaticilar "giris basarisiz" der. (Yayin adresi saglayicidan
      // verildigi icin /live|/movie|/series yollari yok.)
      '/player_api.php': 'http://localhost:3000',
      '/xmltv.php': 'http://localhost:3000',
      '/get.php': 'http://localhost:3000'
    }
  }
})
