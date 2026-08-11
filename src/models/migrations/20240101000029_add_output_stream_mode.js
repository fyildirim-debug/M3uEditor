/**
 * Xtream cikisinda yayin adresinin nasil verilecegini belirler.
 *
 * 'direct'  : M3U ve player_api dogrudan saglayicinin adresini verir. Oynatici
 *             yayini kaynaktan alir; bu sunucu oynatma yolunda hic yer almaz.
 * 'proxy'   : Yerel /live|/movie|/series adresi verilir, istek geldiginde 302
 *             ile saglayiciya yonlendirilir. Saglayici kimligi playlist icinde
 *             gorunmez ama her kanal degisimi once buraya ugrar.
 *
 * Varsayilan 'direct': uygulama bir katalog duzenleyici, oynatma yolunda
 * durmasi gecikme ve tek nokta ariza demek.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.string('output_stream_mode', 10).notNullable().defaultTo('direct');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('output_stream_mode');
  });
};
