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
  removeChannelLogoVariants,
  removeChannelLogos,
};
