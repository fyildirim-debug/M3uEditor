const { Readable } = require('stream');

/**
 * M3U playlist parser.
 * Parses M3U content into channel data objects.
 */
class M3UParser {
  /**
   * Parse M3U content string into channels and errors.
   * @param {string} content - Raw M3U file content
   * @returns {{ channels: Array<object>, errors: Array<object> }}
   */
  parse(content) {
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new Error('M3U içeriği boş veya geçersiz');
    }

    const lines = content.split(/\r?\n/);
    const firstNonEmptyLine = lines.find(line => line.trim() !== '');

    if (!firstNonEmptyLine || !firstNonEmptyLine.trim().startsWith('#EXTM3U')) {
      throw new Error('Geçersiz M3U dosyası: #EXTM3U başlığı eksik');
    }

    const channels = [];
    const errors = [];
    let currentExtInf = null;
    let currentExtInfLine = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (line === '' || line.startsWith('#EXTM3U')) {
        continue;
      }

      if (line.startsWith('#EXTINF:')) {
        // If we had a previous #EXTINF without a URL, report error
        if (currentExtInf !== null) {
          errors.push({
            line: currentExtInfLine,
            message: `#EXTINF satırından sonra URL bulunamadı (satır ${currentExtInfLine})`,
          });
        }

        const parsed = this._parseExtInfLine(line);
        if (parsed) {
          currentExtInf = parsed;
          currentExtInfLine = lineNumber;
        } else {
          errors.push({
            line: lineNumber,
            message: `Bozuk #EXTINF satırı (satır ${lineNumber})`,
          });
          currentExtInf = null;
          currentExtInfLine = null;
        }
        continue;
      }

      // Skip other comment/directive lines
      if (line.startsWith('#')) {
        continue;
      }

      // This is a URL line
      if (currentExtInf !== null) {
        channels.push({
          ...currentExtInf,
          url: line,
        });
        currentExtInf = null;
        currentExtInfLine = null;
      }
      // URL without preceding #EXTINF — just ignore silently
    }

    // If file ends with a dangling #EXTINF (no URL after it)
    if (currentExtInf !== null) {
      errors.push({
        line: currentExtInfLine,
        message: `#EXTINF satırından sonra URL bulunamadı (satır ${currentExtInfLine})`,
      });
    }

    return { channels, errors };
  }

  /**
   * Parse M3U content from a readable stream, yielding channels as they are parsed.
   * @param {ReadableStream} stream - Readable stream of M3U content
   * @returns {AsyncIterable<object>} Async iterable of ChannelData objects
   */
  async *parseStream(stream) {
    let buffer = '';
    let headerChecked = false;
    let currentExtInf = null;

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!headerChecked) {
          if (line === '') continue;
          if (!line.startsWith('#EXTM3U')) {
            throw new Error('Geçersiz M3U dosyası: #EXTM3U başlığı eksik');
          }
          headerChecked = true;
          continue;
        }

        if (line === '' || line.startsWith('#EXTM3U')) {
          continue;
        }

        if (line.startsWith('#EXTINF:')) {
          currentExtInf = this._parseExtInfLine(line);
          continue;
        }

        if (line.startsWith('#')) {
          continue;
        }

        // URL line
        if (currentExtInf !== null) {
          yield { ...currentExtInf, url: line };
          currentExtInf = null;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const line = buffer.trim();
      if (!headerChecked && !line.startsWith('#EXTM3U')) {
        throw new Error('Geçersiz M3U dosyası: #EXTM3U başlığı eksik');
      }
      if (currentExtInf !== null && !line.startsWith('#')) {
        yield { ...currentExtInf, url: line };
      }
    }
  }

  /**
   * Parse a single #EXTINF line into channel metadata.
   * @param {string} line - The #EXTINF line
   * @returns {object|null} Parsed channel data (without url) or null if malformed
   * @private
   */
  _parseExtInfLine(line) {
    // Match #EXTINF: followed by duration and attributes
    // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Display Name
    const commaIndex = line.lastIndexOf(',');
    if (commaIndex === -1) {
      return null;
    }

    const displayName = line.substring(commaIndex + 1).trim();
    const metaPart = line.substring(0, commaIndex);

    // Extract all key="value" pairs
    const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
    const attrs = {};
    let match;
    while ((match = attrRegex.exec(metaPart)) !== null) {
      attrs[match[1]] = match[2];
    }

    // Build channel data with known fields
    const knownKeys = ['tvg-id', 'tvg-name', 'tvg-logo', 'group-title'];
    const extras = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (!knownKeys.includes(key)) {
        extras[key] = value;
      }
    }

    return {
      name: displayName || attrs['tvg-name'] || '',
      logo: attrs['tvg-logo'] || '',
      group: attrs['group-title'] || '',
      epgId: attrs['tvg-id'] || '',
      extras,
    };
  }
}

module.exports = M3UParser;
