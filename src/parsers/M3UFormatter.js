const { Readable } = require('stream');

/**
 * M3U playlist formatter.
 * Converts channel data objects into valid M3U file format.
 */
class M3UFormatter {
  /**
   * Format an array of channels into an M3U string.
   * @param {Array<object>} channels - Array of ChannelData objects
   * @returns {string} Complete M3U content
   */
  format(channels, options = {}) {
    const lines = [this._formatHeader(options)];

    for (const channel of channels) {
      lines.push(this._formatChannel(channel));
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Format channels from an async iterable into a ReadableStream.
   * Memory efficient for large playlists.
   * @param {AsyncIterable<object>} channels - Async iterable of ChannelData objects
   * @returns {ReadableStream} Readable stream of M3U content
   */
  formatStream(channels, options = {}) {
    const self = this;
    let headerSent = false;
    const iterator = channels[Symbol.asyncIterator]
      ? channels[Symbol.asyncIterator]()
      : channels[Symbol.iterator]();

    return new Readable({
      async read() {
        try {
          if (!headerSent) {
            this.push(self._formatHeader(options) + '\n');
            headerSent = true;
          }

          const { value, done } = await iterator.next();
          if (done) {
            this.push(null);
            return;
          }

          this.push(self._formatChannel(value) + '\n');
        } catch (err) {
          this.destroy(err);
        }
      },
    });
  }

  _formatHeader({ urlTvg } = {}) {
    return urlTvg
      ? `#EXTM3U url-tvg="${this._escapeAttribute(urlTvg)}"`
      : '#EXTM3U';
  }

  /**
   * Format a single channel into #EXTINF + URL lines.
   * @param {object} channel - ChannelData object
   * @returns {string} Formatted #EXTINF line followed by URL
   * @private
   */
  _formatChannel(channel) {
    const attrs = [];

    if (channel.epgId) {
      attrs.push(`tvg-id="${this._escapeAttribute(channel.epgId)}"`);
    }
    if (channel.name) {
      attrs.push(`tvg-name="${this._escapeAttribute(channel.name)}"`);
    }
    if (channel.logo) {
      attrs.push(`tvg-logo="${this._escapeAttribute(channel.logo)}"`);
    }
    if (channel.group) {
      attrs.push(`group-title="${this._escapeAttribute(channel.group)}"`);
    }

    // Append extras as additional attributes
    if (channel.extras && typeof channel.extras === 'object') {
      const reserved = new Set(['tvg-id', 'tvg-name', 'tvg-logo', 'group-title']);
      for (const [key, value] of Object.entries(channel.extras)) {
        if (!reserved.has(key.toLowerCase()) && value !== null && value !== undefined && value !== '' && ['string', 'number', 'boolean'].includes(typeof value) && /^[A-Za-z0-9_-]{1,64}$/.test(key)) {
          attrs.push(`${key}="${this._escapeAttribute(value)}"`);
        }
      }
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    const displayName = this._sanitizeLine(channel.name || '');

    return `#EXTINF:-1${attrStr},${displayName}\n${this._sanitizeLine(channel.url || '')}`;
  }

  _sanitizeLine(value) {
    return String(value).replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').trim();
  }

  _escapeAttribute(value) {
    return this._sanitizeLine(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
}

module.exports = M3UFormatter;
