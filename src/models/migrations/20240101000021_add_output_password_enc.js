/**
 * Xtream output sifresinin goruntulenebilir saklanmasi.
 * output_password_hash dogrulama icin kalir; output_password_enc kullanicinin
 * kendi sifresini arayuzde gorebilmesi icin AES-256-GCM ile saklanir.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.text('output_password_enc');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('playlists', (table) => {
    table.dropColumn('output_password_enc');
  });
};
