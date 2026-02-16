const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, '../../../src/models/migrations');

describe('Database Migrations', () => {
  let migrationFiles;

  beforeAll(() => {
    migrationFiles = fs.readdirSync(MIGRATIONS_DIR).sort();
  });

  test('all 8 migration files exist in correct order', () => {
    expect(migrationFiles).toEqual([
      '20240101000001_enable_pg_trgm.js',
      '20240101000002_create_users.js',
      '20240101000003_create_playlists.js',
      '20240101000004_create_categories.js',
      '20240101000005_create_channels.js',
      '20240101000006_create_epg_sources.js',
      '20240101000007_create_epg_channels.js',
      '20240101000008_create_epg_programs.js',
    ]);
  });

  test('each migration exports up and down functions', () => {
    for (const file of migrationFiles) {
      const migration = require(path.join(MIGRATIONS_DIR, file));
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    }
  });

  test('pg_trgm extension migration is first', () => {
    expect(migrationFiles[0]).toContain('enable_pg_trgm');
  });

  test('users table is created before playlists and epg_sources', () => {
    const usersIdx = migrationFiles.findIndex((f) => f.includes('create_users'));
    const playlistsIdx = migrationFiles.findIndex((f) => f.includes('create_playlists'));
    const epgSourcesIdx = migrationFiles.findIndex((f) => f.includes('create_epg_sources'));
    expect(usersIdx).toBeLessThan(playlistsIdx);
    expect(usersIdx).toBeLessThan(epgSourcesIdx);
  });

  test('playlists table is created before categories and channels', () => {
    const playlistsIdx = migrationFiles.findIndex((f) => f.includes('create_playlists'));
    const categoriesIdx = migrationFiles.findIndex((f) => f.includes('create_categories'));
    const channelsIdx = migrationFiles.findIndex((f) => f.includes('create_channels'));
    expect(playlistsIdx).toBeLessThan(categoriesIdx);
    expect(playlistsIdx).toBeLessThan(channelsIdx);
  });

  test('categories table is created before channels', () => {
    const categoriesIdx = migrationFiles.findIndex((f) => f.includes('create_categories'));
    const channelsIdx = migrationFiles.findIndex((f) => f.includes('create_channels'));
    expect(categoriesIdx).toBeLessThan(channelsIdx);
  });

  test('epg_sources is created before epg_channels', () => {
    const sourcesIdx = migrationFiles.findIndex((f) => f.includes('create_epg_sources'));
    const channelsIdx = migrationFiles.findIndex((f) => f.includes('create_epg_channels'));
    expect(sourcesIdx).toBeLessThan(channelsIdx);
  });

  test('epg_channels is created before epg_programs', () => {
    const channelsIdx = migrationFiles.findIndex((f) => f.includes('create_epg_channels'));
    const programsIdx = migrationFiles.findIndex((f) => f.includes('create_epg_programs'));
    expect(channelsIdx).toBeLessThan(programsIdx);
  });
});

describe('Knexfile Configuration', () => {
  const knexConfig = require('../../../knexfile');

  test('has development, test, and production environments', () => {
    expect(knexConfig).toHaveProperty('development');
    expect(knexConfig).toHaveProperty('test');
    expect(knexConfig).toHaveProperty('production');
  });

  test('all environments use pg client', () => {
    expect(knexConfig.development.client).toBe('pg');
    expect(knexConfig.test.client).toBe('pg');
    expect(knexConfig.production.client).toBe('pg');
  });

  test('test database name has _test suffix', () => {
    expect(knexConfig.test.connection.database).toMatch(/_test$/);
  });

  test('migrations directory points to src/models/migrations', () => {
    expect(knexConfig.development.migrations.directory).toBe('./src/models/migrations');
    expect(knexConfig.test.migrations.directory).toBe('./src/models/migrations');
    expect(knexConfig.production.migrations.directory).toBe('./src/models/migrations');
  });

  test('production has connection pool config', () => {
    expect(knexConfig.production.pool).toBeDefined();
    expect(knexConfig.production.pool.min).toBeGreaterThanOrEqual(1);
    expect(knexConfig.production.pool.max).toBeGreaterThanOrEqual(2);
  });
});
