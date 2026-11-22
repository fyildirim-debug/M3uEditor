/**
 * Zamanlayici geri cekilmesi, elle EPG kilidi ve kullanici kategori tasimalari.
 *
 * - Basarisiz bir zamanlanmis sync/EPG yenilemesi eskiden zaman damgasini
 *   ilerletmedigi icin her dakika tekrar calisiyordu. Ardisik hata sayisi ve
 *   bir sonraki deneme zamani saklanir; zamanlayici bu zamandan once denemez.
 * - `channels.epg_locked`: EPG eslesmesi kullanici tarafindan (elle atama ya da
 *   bilincli temizleme) belirlendi; otomatik eslestirme bu kanala dokunmaz.
 * - `channels.original_category_id`: saglayicinin son bildirdigi kategori. Kanal
 *   hala bu kategorideyse sync saglayicinin yeni kategorisini uygular; kullanici
 *   tasidiysa tasima korunur (ad/logo icin kullanilan original_* deseninin aynisi).
 *   Bilincli olarak FK yok: kategori silmede her satir icin tarama yapilmasin.
 *   Mevcut satirlar icin bos birakilir; ilk sync mevcut kategoriyi korur.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.integer('sync_failure_count').notNullable().defaultTo(0);
    table.timestamp('sync_next_attempt_at', { useTz: true }).nullable();
  });
  await knex.schema.alterTable('epg_sources', (table) => {
    table.integer('failure_count').notNullable().defaultTo(0);
    table.timestamp('next_attempt_at', { useTz: true }).nullable();
  });
  await knex.schema.alterTable('channels', (table) => {
    table.boolean('epg_locked').notNullable().defaultTo(false);
    table.uuid('original_category_id').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('channels', (table) => {
    table.dropColumn('original_category_id');
    table.dropColumn('epg_locked');
  });
  await knex.schema.alterTable('epg_sources', (table) => {
    table.dropColumn('next_attempt_at');
    table.dropColumn('failure_count');
  });
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('sync_next_attempt_at');
    table.dropColumn('sync_failure_count');
  });
};
