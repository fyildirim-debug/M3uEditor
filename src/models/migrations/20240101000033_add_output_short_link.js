/**
 * Xtream cikisinin kisa M3U baglantisi.
 *
 * Standart adres kimligi sorgu dizesinde tasir ve uzundur:
 * `/get.php?username=<16>&password=<32>&type=m3u_plus&output=ts` — televizyon
 * uygulamalarina elle girilecek bir sey degil. Kisa baglanti ayni listeyi
 * `/m3u.php?id=<8>&secret=<16>` ile verir: yarisindan kisa, ayni yetki.
 *
 * Sir, sifrede oldugu gibi hem karma (dogrulama) hem sifreli (kullaniciya
 * yeniden gosterebilmek icin) saklanir. Kimlik bilgileri yenilendiginde kisa
 * baglanti da yenilenir, yani eski adres calismaz.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.string('output_short_id', 32).unique();
    table.string('output_short_secret_hash', 64);
    table.text('output_short_secret_enc');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('output_short_id');
    table.dropColumn('output_short_secret_hash');
    table.dropColumn('output_short_secret_enc');
  });
};
