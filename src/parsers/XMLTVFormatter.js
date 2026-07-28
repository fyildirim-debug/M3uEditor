const { Readable } = require('stream');

/**
 * Incremental XMLTV writer. It deliberately emits one XML element per chunk so
 * callers can pipe very large guides without assembling the document in memory.
 */
class XMLTVFormatter {
  formatStream(channels, programmes) {
    const self = this;

    async function* document() {
      yield '<?xml version="1.0" encoding="UTF-8"?>\n';
      yield '<tv generator-info-name="M3uEditor">\n';

      for (const channel of channels) {
        yield self.formatChannel(channel);
      }

      for await (const programme of programmes) {
        yield self.formatProgramme(programme);
      }

      yield '</tv>\n';
    }

    return Readable.from(document(), {
      encoding: 'utf8',
      objectMode: false,
      highWaterMark: 16 * 1024,
    });
  }

  formatChannel(channel) {
    const id = this.escape(channel.id);
    const name = this.escape(channel.name || channel.id);
    const icon = channel.icon ? `\n    <icon src="${this.escape(channel.icon)}"/>` : '';
    return `  <channel id="${id}">\n    <display-name>${name}</display-name>${icon}\n  </channel>\n`;
  }

  formatProgramme(programme) {
    const stop = programme.stop ? ` stop="${this.formatTimestamp(programme.stop)}"` : '';
    const description = programme.description !== null && programme.description !== undefined
      ? `\n    <desc>${this.escape(programme.description)}</desc>`
      : '';

    return `  <programme start="${this.formatTimestamp(programme.start)}"${stop} channel="${this.escape(programme.channelId)}">\n    <title>${this.escape(programme.title)}</title>${description}\n  </programme>\n`;
  }

  formatTimestamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError('Invalid XMLTV timestamp');
    }

    const part = (number) => String(number).padStart(2, '0');
    return `${date.getUTCFullYear()}${part(date.getUTCMonth() + 1)}${part(date.getUTCDate())}${part(date.getUTCHours())}${part(date.getUTCMinutes())}${part(date.getUTCSeconds())} +0000`;
  }

  /**
   * Keep only XML 1.0 code points, then escape all five predefined XML
   * entities. Unicode-aware filtering preserves valid astral characters such
   * as emoji while rejecting isolated UTF-16 surrogates.
   */
  escape(value) {
    // With the Unicode flag, a valid surrogate pair is treated as one astral
    // code point and is not matched by the surrogate range. Isolated
    // surrogates are removed along with the disallowed XML 1.0 characters.
    return String(value ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = XMLTVFormatter;
