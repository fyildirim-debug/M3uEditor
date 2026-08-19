const fs = require('fs').promises;
const path = require('path');
const { validate: validateUuid } = require('uuid');
const config = require('../config');
const logger = require('../config/logger');

const LOGO_EXTENSIONS = Object.freeze(['png', 'jpg', 'gif', 'webp']);
const DELETE_CONCURRENCY = 100;

function normalizeChannelId(channelId) {
  if (typeof channelId !== 'string' || !validateUuid(channelId)) {
    throw new TypeError('Channel logo paths require a valid UUID');
  }
  return channelId.toLowerCase();
}

function normalizeExtension(extension) {
  const normalized = typeof extension === 'string' ? extension.toLowerCase() : '';
  if (!LOGO_EXTENSIONS.includes(normalized)) {
    throw new TypeError('Unsupported channel logo extension');
  }
  return normalized;
}

function getChannelLogoFilename(channelId, extension) {
  return `${normalizeChannelId(channelId)}.${normalizeExtension(extension)}`;
}

function getChannelLogoPath(channelId, extension) {
  return path.join(config.uploadDir, getChannelLogoFilename(channelId, extension));
}

/**
 * Yuklenen logonun adresi kanal kimliginden turedigi icin ayni kanala ikinci
 * kez logo yuklendiginde adres degismiyordu. `/logos/` yolu hem nginx hem
 * express tarafindan 30 gun `immutable` olarak onbelleklenir; adres ayni
 * kalinca tarayici yeni dosyayi hic istemez ve kullanici eski gorseli gormeye
 * devam eder. Adrese surum damgasi eklemek onbellegi bozar, uzun onbellek
 * suresini de korur.
 * @param {string} channelId
 * @param {string} extension
 * @param {number|string} [version] - Varsayilan: simdiki zaman damgasi
 * @returns {string} `/logos/<uuid>.<uzanti>?v=<surum>`
 */
function buildChannelLogoUrl(channelId, extension, version = Date.now()) {
  return `/logos/${getChannelLogoFilename(channelId, extension)}?v=${version}`;
}

/**
 * Surum damgasini atarak yalin logo yolunu dondurur. Depolanan adresi dosya
 * adiyla karsilastiran yerler (ornegin yetim logo temizligi) bunu kullanmali;
 * aksi halde surumlu her adres yetim sanilir.
 * @param {unknown} logoUrl
 * @returns {string} Sorgu dizesi ve cengel atilmis yol
 */
function stripLogoUrlVersion(logoUrl) {
  return typeof logoUrl === 'string' ? logoUrl.split(/[?#]/)[0] : '';
}

async function removeLogoFile(channelId, extension) {
  try {
    await fs.unlink(getChannelLogoPath(channelId, extension));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn({ err: error, channelId, extension }, 'Channel logo file could not be removed');
    }
  }
}

async function removeChannelLogoVariants(channelIds, preserveExtension = null) {
  const preserved = preserveExtension === null ? null : normalizeExtension(preserveExtension);
  const normalizedIds = [];

  for (const channelId of Array.isArray(channelIds) ? channelIds : [channelIds]) {
    try {
      normalizedIds.push(normalizeChannelId(channelId));
    } catch (error) {
      logger.warn({ err: error, channelId }, 'Invalid channel id skipped during logo cleanup');
    }
  }
  if (!normalizedIds.length) return;

  // 50k+ kanalli playlistlerde her kanal x her uzanti icin kör unlink (yuzbinlerce
  // syscall) saniyeler surer. Dizini bir kez tara, yalnizca var olan dosyalari sil.
  let existingFiles;
  try {
    existingFiles = new Set(await fs.readdir(config.uploadDir));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return;
  }

  const files = [];
  for (const channelId of new Set(normalizedIds)) {
    for (const extension of LOGO_EXTENSIONS) {
      if (extension === preserved) continue;
      const filename = getChannelLogoFilename(channelId, extension);
      if (existingFiles.has(filename)) files.push({ channelId, extension });
    }
  }

  for (let offset = 0; offset < files.length; offset += DELETE_CONCURRENCY) {
    await Promise.all(files.slice(offset, offset + DELETE_CONCURRENCY)
      .map(({ channelId, extension }) => removeLogoFile(channelId, extension)));
  }
}

async function removeChannelLogos(channelIds) {
  await removeChannelLogoVariants(channelIds);
}

module.exports = {
  LOGO_EXTENSIONS,
  getChannelLogoFilename,
  getChannelLogoPath,
  buildChannelLogoUrl,
  stripLogoUrlVersion,
  removeChannelLogoVariants,
  removeChannelLogos,
};
