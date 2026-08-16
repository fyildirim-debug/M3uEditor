/**
 * Xtream cikisindaki 'proxy' yayin modu kaldirildi.
 *
 * 'proxy' modda kanal adresi bu sunucuyu gosteriyor, istek geldiginde 302 ile
 * saglayiciya yonlendiriliyordu; boylece uygulama her kanal degisiminin
 * oynatma yolunda duruyordu. Artik tek davranis var: M3U ve player_api her
 * zaman saglayicinin kendi adresini verir, bu sunucu yayin adresi olarak
 * hicbir kosulda gorunmez. Modun secenegi kalmadigi icin kolon da dusuruldu.
 *
 * Geri alinirsa kolon varsayilan 'direct' ile geri gelir — proxy davranisi
 * kodda artik bulunmadigindan yalnizca sema geri doner, islev degil.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('output_stream_mode');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.string('output_stream_mode', 10).notNullable().defaultTo('direct');
  });
};
