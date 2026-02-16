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
  format(channels) {
    const lines = ['#EXTM3U'];

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
  formatStream(channels) {
    const self = this;
    let headerSent = false;
    const iterator = channels[Symbol.asyncIterator]
      ? channels[Symbol.asyncIterator]()
      : channels[Symbol.iterator]();

    return new Readable({
      async read() {
        try {
          if (!headerSent) {
            this.push('#EXTM3U\n');
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

  /**
   * Format a single channel into #EXTINF + URL lines.
   * @param {object} channel - ChannelData object
   * @returns {string} Formatted #EXTINF line followed by URL
   * @private
   */
  _formatChannel(channel) {
    const attrs = [];

    if (channel.epgId) {
      attrs.push(`tvg-id="${channel.epgId}"`);
    }
    if (channel.name) {
      attrs.push(`tvg-name="${channel.name}"`);
    }
    if (channel.logo) {
      attrs.push(`tvg-logo="${channel.logo}"`);
    }
    if (channel.group) {
      attrs.push(`group-title="${channel.group}"`);
    }

    // Append extras as additional attributes
    if (channel.extras && typeof channel.extras === 'object') {
      for (const [key, value] of Object.entries(channel.extras)) {
        if (value) {
          attrs.push(`${key}="${value}"`);
        }
      }
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    const displayName = channel.name || '';

    return `#EXTINF:-1${attrStr},${displayName}\n${channel.url || ''}`;
  }
}

module.exports = M3UFormatter;
