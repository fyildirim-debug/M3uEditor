require('dotenv').config();
const path = require('path');

// Yollar dosyanin konumuna gore: masaustu uygulamasi ve paketlenmis kurulumlar
// calisma dizini proje koku olmadan da migration'lari bulabilsin.
const MIGRATIONS_DIR = path.join(__dirname, 'src', 'models', 'migrations');
const SEEDS_DIR = path.join(__dirname, 'src', 'models', 'seeds');

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'm3u_playlist_editor',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: {
      directory: MIGRATIONS_DIR,
    },
    seeds: {
      directory: SEEDS_DIR,
    },
  },
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: (process.env.DB_NAME || 'm3u_playlist_editor') + '_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: {
      directory: MIGRATIONS_DIR,
    },
    seeds: {
      directory: SEEDS_DIR,
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: MIGRATIONS_DIR,
    },
    seeds: {
      directory: SEEDS_DIR,
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};
