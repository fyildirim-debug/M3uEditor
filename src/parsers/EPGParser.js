/**
 * XMLTV EPG Parser.
 * Parses XMLTV format XML content into EPG channel and program data.
 * Uses regex-based parsing for string input and streaming approach for large files.
 */
class EPGParser {
  /**
   * Parse XMLTV date string to JavaScript Date object.
   * XMLTV format: "YYYYMMDDHHmmss +HHMM" or "YYYYMMDDHHmmss"
   * @param {string} dateStr - XMLTV date string
   * @returns {Date|null} Parsed Date or null if invalid
   */
  static parseXMLTVDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmed = dateStr.trim();
    // Match: YYYYMMDDHHmmss with optional timezone offset
    const match = trimmed.match(
      /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/
    );
    if (!match) return null;

    const [, year, month, day, hour, minute, second, tz] = match;

    if (tz) {
      const tzSign = tz[0] === '+' ? '+' : '-';
      const tzHours = tz.substring(1, 3);
      const tzMinutes = tz.substring(3, 5);
      const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}${tzSign}${tzHours}:${tzMinutes}`;
      const date = new Date(isoStr);
      return isNaN(date.getTime()) ? null : date;
    }

    // No timezone — treat as UTC
    const date = new Date(
      Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10)
      )
    );
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parse XMLTV content string into channels and programs.
   * @param {string} xmlContent - Raw XMLTV XML content
   * @returns {{ channels: Array<object>, programs: Array<object> }}
   */
  parse(xmlContent) {
    if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim() === '') {
      throw new Error('EPG içeriği boş veya geçersiz');
    }

    // Basic XML validation: must contain <tv> root element
    if (!/<tv[\s>]/i.test(xmlContent)) {
      throw new Error('Geçersiz XMLTV: <tv> kök elemanı bulunamadı');
    }

    const channels = this._parseChannels(xmlContent);
    const programs = this._parsePrograms(xmlContent);

    return { channels, programs };
  }

  /**
   * Parse XMLTV content from a readable stream, yielding channels and programs.
   * @param {ReadableStream} stream - Readable stream of XMLTV content
   * @returns {AsyncIterable<{ type: 'channel'|'program', data: object }>}
   */
  async *parseStream(stream) {
    let buffer = '';
    let tvTagFound = false;

    for await (const chunk of stream) {
      buffer += chunk.toString();

      if (!tvTagFound) {
        if (/<tv[\s>]/i.test(buffer)) {
          tvTagFound = true;
        }
      }

      // Extract complete <channel>...</channel> elements
      yield* this._extractElements(buffer, 'channel', (match) => {
        const channel = this._parseChannelElement(match);
        return channel ? { type: 'channel', data: channel } : null;
      });
      // Remove processed channel elements from buffer
      buffer = buffer.replace(/<channel\b[^>]*>[\s\S]*?<\/channel>/gi, '');

      // Extract complete <programme>...</programme> elements
      yield* this._extractElements(buffer, 'programme', (match) => {
        const program = this._parseProgrammeElement(match);
        return program ? { type: 'program', data: program } : null;
      });
      // Remove processed programme elements from buffer
      buffer = buffer.replace(/<programme\b[^>]*>[\s\S]*?<\/programme>/gi, '');
    }

    // Process any remaining complete elements in buffer
    yield* this._extractElements(buffer, 'channel', (match) => {
      const channel = this._parseChannelElement(match);
      return channel ? { type: 'channel', data: channel } : null;
    });
    buffer = buffer.replace(/<channel\b[^>]*>[\s\S]*?<\/channel>/gi, '');

    yield* this._extractElements(buffer, 'programme', (match) => {
      const program = this._parseProgrammeElement(match);
      return program ? { type: 'program', data: program } : null;
    });

    if (!tvTagFound) {
      throw new Error('Geçersiz XMLTV: <tv> kök elemanı bulunamadı');
    }
  }

  /**
   * Extract and yield complete XML elements from buffer.
   * @param {string} buffer - Current buffer content
   * @param {string} tagName - XML tag name to extract
   * @param {Function} parser - Function to parse each element
   * @private
   */
  *_extractElements(buffer, tagName, parser) {
    const regex = new RegExp(
      `<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`,
      'gi'
    );
    let match;
    while ((match = regex.exec(buffer)) !== null) {
      const result = parser(match[0]);
      if (result) yield result;
    }
  }

  /**
   * Parse all <channel> elements from XMLTV content.
   * @param {string} xml - XMLTV content
   * @returns {Array<object>} Array of EPGChannel objects
   * @private
   */
  _parseChannels(xml) {
    const channels = [];
    const channelRegex = /<channel\b[^>]*>[\s\S]*?<\/channel>/gi;
    let match;

    while ((match = channelRegex.exec(xml)) !== null) {
      const channel = this._parseChannelElement(match[0]);
      if (channel) channels.push(channel);
    }

    return channels;
  }

  /**
   * Parse a single <channel> element.
   * @param {string} element - Channel XML element string
   * @returns {object|null} EPGChannel or null if missing required fields
   * @private
   */
  _parseChannelElement(element) {
    const idMatch = element.match(/<channel\b[^>]*\bid=["']([^"']*)["']/i);
    if (!idMatch || !idMatch[1]) return null;

    const channelId = idMatch[1];

    const nameMatch = element.match(
      /<display-name[^>]*>([\s\S]*?)<\/display-name>/i
    );
    const displayName = nameMatch ? this._decodeXMLEntities(nameMatch[1].trim()) : '';

    const iconMatch = element.match(/<icon\b[^>]*\bsrc=["']([^"']*)["']/i);
    const iconUrl = iconMatch ? iconMatch[1] : '';

    return { channelId, displayName, iconUrl };
  }

  /**
   * Parse all <programme> elements from XMLTV content.
   * @param {string} xml - XMLTV content
   * @returns {Array<object>} Array of EPGProgram objects
   * @private
   */
  _parsePrograms(xml) {
    const programs = [];
    const progRegex = /<programme\b[^>]*>[\s\S]*?<\/programme>/gi;
    let match;

    while ((match = progRegex.exec(xml)) !== null) {
      const program = this._parseProgrammeElement(match[0]);
      if (program) programs.push(program);
    }

    return programs;
  }

  /**
   * Parse a single <programme> element.
   * @param {string} element - Programme XML element string
   * @returns {object|null} EPGProgram or null if missing required fields
   * @private
   */
  _parseProgrammeElement(element) {
    const startMatch = element.match(/\bstart=["']([^"']*)["']/i);
    const stopMatch = element.match(/\bstop=["']([^"']*)["']/i);
    const channelMatch = element.match(/\bchannel=["']([^"']*)["']/i);

    if (!startMatch || !channelMatch) return null;

    const startTime = EPGParser.parseXMLTVDate(startMatch[1]);
    const endTime = stopMatch ? EPGParser.parseXMLTVDate(stopMatch[1]) : null;

    if (!startTime) return null;

    const channelId = channelMatch[1];

    const titleMatch = element.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this._decodeXMLEntities(titleMatch[1].trim()) : '';

    const descMatch = element.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i);
    const description = descMatch ? this._decodeXMLEntities(descMatch[1].trim()) : '';

    return { channelId, startTime, endTime, title, description };
  }

  /**
   * Decode basic XML entities.
   * @param {string} str - String with XML entities
   * @returns {string} Decoded string
   * @private
   */
  _decodeXMLEntities(str) {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}

module.exports = EPGParser;
