/**
 * Demo veri seed'i — bir kerelik çalıştır.
 *
 *   node scripts/seed-demo.js
 *
 * Idempotent: aynı e-posta ile demo kullanıcı varsa playlist tekrar eklenmez.
 *
 * Demo hesap:
 *   E-posta: demo@m3ueditor.local
 *   Parola:  demo1234
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

const DEMO_EMAIL = 'demo@m3ueditor.local';
const DEMO_PASSWORD = 'demo1234';

const CATEGORIES = [
  { name: 'Ulusal Kanallar', stream_type: 'live' },
  { name: 'Spor', stream_type: 'live' },
  { name: 'Haber', stream_type: 'live' },
  { name: 'Belgesel', stream_type: 'live' },
  { name: 'Çocuk', stream_type: 'live' },
  { name: 'Aksiyon Filmleri', stream_type: 'vod' },
  { name: 'Komedi Filmleri', stream_type: 'vod' },
  { name: 'Dram Dizileri', stream_type: 'series' },
  { name: 'Yabancı Diziler', stream_type: 'series' },
];

const CHANNELS = [
  // Ulusal Kanallar (live)
  { cat: 'Ulusal Kanallar', name: 'TRT 1 HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/TRT_1_logo_%282021-%29.svg/120px-TRT_1_logo_%282021-%29.svg.png', epg: 'trt1.tr' },
  { cat: 'Ulusal Kanallar', name: 'Show TV HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Show_TV_logo.svg/120px-Show_TV_logo.svg.png', epg: 'showtv.tr' },
  { cat: 'Ulusal Kanallar', name: 'Star TV HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Star_TV_logo_%282013-%29.svg/120px-Star_TV_logo_%282013-%29.svg.png', epg: 'startv.tr' },
  { cat: 'Ulusal Kanallar', name: 'Kanal D HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Kanal_D_logo.svg/120px-Kanal_D_logo.svg.png', epg: 'kanald.tr' },
  { cat: 'Ulusal Kanallar', name: 'ATV HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/ATV_Turkey_logo_2021.svg/120px-ATV_Turkey_logo_2021.svg.png', epg: 'atv.tr' },
  { cat: 'Ulusal Kanallar', name: 'TV8 HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/TV8_logo_%282014-%29.svg/120px-TV8_logo_%282014-%29.svg.png', epg: 'tv8.tr' },
  { cat: 'Ulusal Kanallar', name: 'FOX HD', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Fox_Turkey_logo.svg/120px-Fox_Turkey_logo.svg.png', epg: 'foxtr.tr' },

  // Spor
  { cat: 'Spor', name: 'beIN SPORTS 1 HD', logo: null, epg: 'beinsports1.tr' },
  { cat: 'Spor', name: 'beIN SPORTS 2 HD', logo: null, epg: 'beinsports2.tr' },
  { cat: 'Spor', name: 'beIN SPORTS 3 HD', logo: null, epg: 'beinsports3.tr' },
  { cat: 'Spor', name: 'S Sport HD', logo: null, epg: 'ssport.tr' },
  { cat: 'Spor', name: 'TRT Spor HD', logo: null, epg: 'trtspor.tr' },

  // Haber
  { cat: 'Haber', name: 'CNN Türk HD', logo: null, epg: 'cnnturk.tr' },
  { cat: 'Haber', name: 'NTV HD', logo: null, epg: 'ntv.tr' },
  { cat: 'Haber', name: 'Habertürk HD', logo: null, epg: 'haberturk.tr' },
  { cat: 'Haber', name: 'BBC News HD', logo: null, epg: 'bbcnews.uk' },

  // Belgesel
  { cat: 'Belgesel', name: 'National Geographic HD', logo: null, epg: 'natgeo' },
  { cat: 'Belgesel', name: 'Discovery Channel HD', logo: null, epg: 'discovery' },
  { cat: 'Belgesel', name: 'TRT Belgesel HD', logo: null, epg: 'trtbelgesel.tr' },

  // Çocuk
  { cat: 'Çocuk', name: 'Cartoon Network HD', logo: null, epg: 'cartoonnetwork' },
  { cat: 'Çocuk', name: 'Nickelodeon HD', logo: null, epg: 'nickelodeon' },
  { cat: 'Çocuk', name: 'TRT Çocuk HD', logo: null, epg: 'trtcocuk.tr' },

  // Aksiyon Filmleri (VOD)
  { cat: 'Aksiyon Filmleri', name: 'John Wick 4 (2023)', logo: null, type: 'vod' },
  { cat: 'Aksiyon Filmleri', name: 'Dune: Part Two (2024)', logo: null, type: 'vod' },
  { cat: 'Aksiyon Filmleri', name: 'Mission: Impossible 7 (2023)', logo: null, type: 'vod' },
  { cat: 'Aksiyon Filmleri', name: 'Top Gun: Maverick (2022)', logo: null, type: 'vod' },

  // Komedi Filmleri (VOD)
  { cat: 'Komedi Filmleri', name: 'Recep İvedik 7 (2024)', logo: null, type: 'vod' },
  { cat: 'Komedi Filmleri', name: 'Eyyvah Eyvah 3 (2014)', logo: null, type: 'vod' },
  { cat: 'Komedi Filmleri', name: 'Düğün Dernek (2013)', logo: null, type: 'vod' },

  // Dram Dizileri (Series)
  { cat: 'Dram Dizileri', name: 'Kuruluş Osman', logo: null, type: 'series' },
  { cat: 'Dram Dizileri', name: 'Teşkilat', logo: null, type: 'series' },
  { cat: 'Dram Dizileri', name: 'Yargı', logo: null, type: 'series' },

  // Yabancı Diziler (Series)
  { cat: 'Yabancı Diziler', name: 'Breaking Bad', logo: null, type: 'series' },
  { cat: 'Yabancı Diziler', name: 'Game of Thrones', logo: null, type: 'series' },
  { cat: 'Yabancı Diziler', name: 'The Crown', logo: null, type: 'series' },
  { cat: 'Yabancı Diziler', name: 'Stranger Things', logo: null, type: 'series' },
];

async function seed() {
  console.log('🌱 Demo seed başlıyor...\n');

  // 1) Kullanıcı kontrolü
  const existing = await db('users').where({ email: DEMO_EMAIL }).first();
  if (existing) {
    console.log(`⏭️  Demo kullanıcı zaten var: ${DEMO_EMAIL}`);
    const plCount = await db('playlists').where({ user_id: existing.id }).count('* as c').first();
    if (parseInt(plCount.c, 10) > 0) {
      console.log('⏭️  Playlist zaten ekli, çıkılıyor.');
      await db.destroy();
      return;
    }
  }

  // 2) Kullanıcı oluştur
  let userId;
  if (existing) {
    userId = existing.id;
  } else {
    userId = uuidv4();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await db('users').insert({
      id: userId,
      email: DEMO_EMAIL,
      password_hash: passwordHash,
      email_verified_at: db.fn.now(),
    });
    console.log(`✅ Kullanıcı oluşturuldu: ${DEMO_EMAIL}`);
  }

  // 3) Playlist oluştur
  const playlistId = uuidv4();
  await db('playlists').insert({
    id: playlistId,
    user_id: userId,
    name: 'Demo Playlist (Türkçe Paket)',
    xtream_server_url: 'http://demo.example.com:8080',
    xtream_username: 'demo_user',
    xtream_password_enc: 'enc:demo',
    xtream_stream_types: JSON.stringify(['live', 'vod', 'series']),
    last_synced_at: db.fn.now(),
  });
  console.log(`✅ Playlist oluşturuldu: Demo Playlist (Türkçe Paket)`);

  // 4) Kategoriler
  const categoryMap = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const id = uuidv4();
    await db('categories').insert({
      id,
      playlist_id: playlistId,
      name: cat.name,
      sort_order: i,
    });
    categoryMap[cat.name] = { id, stream_type: cat.stream_type };
  }
  console.log(`✅ ${CATEGORIES.length} kategori eklendi`);

  // 5) Kanallar
  const rows = CHANNELS.map((ch, i) => {
    const cat = categoryMap[ch.cat];
    const streamType = ch.type || cat.stream_type;
    const slug = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      id: uuidv4(),
      playlist_id: playlistId,
      category_id: cat.id,
      name: ch.name,
      original_name: ch.name,
      logo_url: ch.logo,
      original_logo_url: ch.logo,
      stream_url: `http://demo.example.com:8080/${streamType}/demo_user/demo_pass/${slug}-${i}.ts`,
      epg_channel_id: ch.epg || null,
      stream_type: streamType,
      sort_order: i,
    };
  });
  await db('channels').insert(rows);
  console.log(`✅ ${rows.length} kanal eklendi`);

  console.log('\n🎉 Demo seed tamamlandı!\n');
  console.log('   Giriş bilgileri:');
  console.log(`   E-posta: ${DEMO_EMAIL}`);
  console.log(`   Parola : ${DEMO_PASSWORD}\n`);

  await db.destroy();
}

seed().catch(async (err) => {
  console.error('❌ Seed hatası:', err.message);
  console.error(err);
  await db.destroy().catch(() => {});
  process.exit(1);
});
