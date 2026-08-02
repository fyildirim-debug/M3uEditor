/**
 * XMLTV EPG Parser.
 * Parses XMLTV format XML content into EPG channel and program data.
 * Uses regex-based parsing for string input and streaming approach for large files.
 */
/**
 * Kok elemandan sonra yorum ve isleme yonergesi gelmesi XML'de gecerlidir
 * (bazi saglayicilar `</tv>` ardina imza yorumu ekliyor). Kesik icerik
 * kontrolu bunlari yok saymali, aksi halde saglam bir rehber reddedilir.
 */
function trimTrailingMisc(text) {
  let result = String(text).replace(/\s+$/u, '');
  for (;;) {
    const previous = result;
    result = result
      .replace(/<!--(?:(?!-->)[\s\S])*-->$/u, '')
      .replace(/<\?(?:(?!\?>)[\s\S])*\?>$/u, '')
      .replace(/\s+$/u, '');
    if (result === previous) return result;
  }
}

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
    if (!trimTrailingMisc(xmlContent).toLowerCase().endsWith('</tv>')) {
      throw new Error('Geçersiz XMLTV: </tv> kapanış etiketi bulunamadı; içerik kesilmiş olabilir');
    }
    const incomplete = this._findUnbalancedElement(xmlContent);
    if (incomplete) {
      throw new Error(`Geçersiz XMLTV: <${incomplete}> elemanı tamamlanamadı`);
    }

    const channels = this._parseChannels(xmlContent);
    const programs = this._parsePrograms(xmlContent);

    return { channels, programs };
  }

  _findUnbalancedElement(xml) {
    for (const tagName of ['channel', 'programme']) {
      let openings = 0;
      let closings = 0;
      const openingPattern = new RegExp(`<${tagName}\\b`, 'gi');
      const closingPattern = new RegExp(`<\\/${tagName}>`, 'gi');
      while (openingPattern.exec(xml)) openings += 1;
      while (closingPattern.exec(xml)) closings += 1;
      if (openings !== closings) return tagName;
    }
    return null;
  }

  /**
   * Parse XMLTV content from a readable stream, yielding channels and programs.
   * @param {ReadableStream} stream - Readable stream of XMLTV content
   * @returns {AsyncIterable<{ type: 'channel'|'program', data: object }>}
   */
  async *parseStream(stream) {
    const { StringDecoder } = require('string_decoder');
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    let tvTagFound = false;
    let documentEnd = '';

    const append = (text) => {
      if (!text) return;
      buffer += text;
      // Kok etiketten sonra gelebilecek yorum blogu icin yeterli kuyruk tutulur.
      documentEnd = `${documentEnd}${text}`.replace(/\s+$/u, '').slice(-4096);
      if (!tvTagFound && /<tv[\s>]/i.test(buffer)) tvTagFound = true;
    };

    const extractAvailable = function* (parser) {
      while (true) {
        const opening = /<(channel|programme)\b/i.exec(buffer);
        if (!opening) {
          // Only a small boundary is needed when no element is open. This keeps
          // inter-element whitespace from growing with the whole document.
          buffer = buffer.slice(-64);
          return;
        }

        const tagName = opening[1].toLowerCase();
        const elementStart = opening.index;
        const closing = new RegExp(`<\\/${tagName}>`, 'i').exec(buffer.slice(elementStart));
        if (!closing) {
          buffer = buffer.slice(elementStart);
          if (buffer.length > 2_000_000) {
            throw new Error(`Geçersiz XMLTV: <${tagName}> elemanı tamamlanamadı`);
          }
          return;
        }

        const elementEnd = elementStart + closing.index + closing[0].length;
        const element = buffer.slice(elementStart, elementEnd);
        buffer = buffer.slice(elementEnd);
        const data = tagName === 'channel'
          ? parser._parseChannelElement(element)
          : parser._parseProgrammeElement(element);
        if (data) yield { type: tagName === 'channel' ? 'channel' : 'program', data };
      }
    };

    for await (const chunk of stream) {
      append(decoder.write(chunk));
      yield* extractAvailable(this);
    }
    append(decoder.end());
    yield* extractAvailable(this);

    if (!tvTagFound) {
      throw new Error('Geçersiz XMLTV: <tv> kök elemanı bulunamadı');
    }
    if (!trimTrailingMisc(documentEnd).toLowerCase().endsWith('</tv>')) {
      throw new Error('Geçersiz XMLTV: </tv> kapanış etiketi bulunamadı; içerik kesilmiş olabilir');
    }
    const incomplete = /<(channel|programme)\b/i.exec(buffer);
    if (incomplete) {
      throw new Error(`Geçersiz XMLTV: <${incomplete[1].toLowerCase()}> elemanı tamamlanamadı`);
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
