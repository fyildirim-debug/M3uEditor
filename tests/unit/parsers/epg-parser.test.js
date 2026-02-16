const { Readable } = require('stream');
const EPGParser = require('../../../src/parsers/EPGParser');

describe('EPGParser', () => {
  let parser;

  beforeEach(() => {
    parser = new EPGParser();
  });

  describe('parseXMLTVDate()', () => {
    it('should parse date with timezone offset', () => {
      const date = EPGParser.parseXMLTVDate('20240101120000 +0000');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should parse date with positive timezone offset', () => {
      const date = EPGParser.parseXMLTVDate('20240101120000 +0300');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-01T09:00:00.000Z');
    });

    it('should parse date with negative timezone offset', () => {
      const date = EPGParser.parseXMLTVDate('20240101120000 -0500');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-01T17:00:00.000Z');
    });

    it('should parse date without timezone as UTC', () => {
      const date = EPGParser.parseXMLTVDate('20240615143000');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-06-15T14:30:00.000Z');
    });

    it('should return null for invalid date string', () => {
      expect(EPGParser.parseXMLTVDate('invalid')).toBeNull();
      expect(EPGParser.parseXMLTVDate('')).toBeNull();
      expect(EPGParser.parseXMLTVDate(null)).toBeNull();
      expect(EPGParser.parseXMLTVDate(undefined)).toBeNull();
    });
  });

  describe('parse()', () => {
    const validXML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="channel1">
    <display-name>Channel 1</display-name>
    <icon src="http://logo1.png"/>
  </channel>
  <channel id="channel2">
    <display-name>Channel 2</display-name>
    <icon src="http://logo2.png"/>
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="channel1">
    <title>News at Noon</title>
    <desc>Daily news broadcast</desc>
  </programme>
  <programme start="20240101130000 +0000" stop="20240101140000 +0000" channel="channel2">
    <title>Sports Hour</title>
    <desc>Live sports coverage</desc>
  </programme>
</tv>`;

    it('should parse valid XMLTV with channels and programs', () => {
      const result = parser.parse(validXML);

      expect(result.channels).toHaveLength(2);
      expect(result.programs).toHaveLength(2);

      expect(result.channels[0]).toEqual({
        channelId: 'channel1',
        displayName: 'Channel 1',
        iconUrl: 'http://logo1.png',
      });

      expect(result.programs[0]).toEqual({
        channelId: 'channel1',
        startTime: new Date('2024-01-01T12:00:00.000Z'),
        endTime: new Date('2024-01-01T13:00:00.000Z'),
        title: 'News at Noon',
        description: 'Daily news broadcast',
      });
    });

    it('should parse multiple channels and programs', () => {
      const result = parser.parse(validXML);

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].channelId).toBe('channel1');
      expect(result.channels[1].channelId).toBe('channel2');

      expect(result.programs).toHaveLength(2);
      expect(result.programs[0].title).toBe('News at Noon');
      expect(result.programs[1].title).toBe('Sports Hour');
    });

    it('should handle missing optional fields (icon, description)', () => {
      const xml = `<tv>
  <channel id="ch1">
    <display-name>Minimal Channel</display-name>
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">
    <title>A Show</title>
  </programme>
</tv>`;

      const result = parser.parse(xml);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].iconUrl).toBe('');

      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].description).toBe('');
    });

    it('should throw error for empty content', () => {
      expect(() => parser.parse('')).toThrow('boş veya geçersiz');
      expect(() => parser.parse(null)).toThrow('boş veya geçersiz');
      expect(() => parser.parse(undefined)).toThrow('boş veya geçersiz');
    });

    it('should throw error for invalid XML without <tv> root', () => {
      const xml = `<?xml version="1.0"?><data><item>test</item></data>`;
      expect(() => parser.parse(xml)).toThrow('<tv> kök elemanı bulunamadı');
    });

    it('should skip channels without id attribute', () => {
      const xml = `<tv>
  <channel>
    <display-name>No ID Channel</display-name>
  </channel>
  <channel id="valid">
    <display-name>Valid Channel</display-name>
  </channel>
</tv>`;

      const result = parser.parse(xml);
      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].channelId).toBe('valid');
    });

    it('should skip programmes without required start or channel', () => {
      const xml = `<tv>
  <programme stop="20240101130000 +0000" channel="ch1">
    <title>No Start</title>
  </programme>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">
    <title>Valid Program</title>
  </programme>
</tv>`;

      const result = parser.parse(xml);
      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].title).toBe('Valid Program');
    });

    it('should decode XML entities in text content', () => {
      const xml = `<tv>
  <channel id="ch1">
    <display-name>News &amp; Sports</display-name>
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">
    <title>Tom &amp; Jerry</title>
    <desc>A &quot;classic&quot; show</desc>
  </programme>
</tv>`;

      const result = parser.parse(xml);
      expect(result.channels[0].displayName).toBe('News & Sports');
      expect(result.programs[0].title).toBe('Tom & Jerry');
      expect(result.programs[0].description).toBe('A "classic" show');
    });

    it('should handle programme without stop time', () => {
      const xml = `<tv>
  <programme start="20240101120000 +0000" channel="ch1">
    <title>Open Ended</title>
  </programme>
</tv>`;

      const result = parser.parse(xml);
      expect(result.programs).toHaveLength(1);
      expect(result.programs[0].endTime).toBeNull();
    });
  });

  describe('parseStream()', () => {
    function createStream(content) {
      return Readable.from([content]);
    }

    function createChunkedStream(chunks) {
      return Readable.from(chunks);
    }

    it('should yield channels and programs from a stream', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="ch1">
    <display-name>Channel 1</display-name>
    <icon src="http://logo.png"/>
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">
    <title>Test Show</title>
    <desc>A test program</desc>
  </programme>
</tv>`;

      const items = [];
      for await (const item of parser.parseStream(createStream(xml))) {
        items.push(item);
      }

      expect(items).toHaveLength(2);

      expect(items[0].type).toBe('channel');
      expect(items[0].data.channelId).toBe('ch1');
      expect(items[0].data.displayName).toBe('Channel 1');

      expect(items[1].type).toBe('program');
      expect(items[1].data.channelId).toBe('ch1');
      expect(items[1].data.title).toBe('Test Show');
    });

    it('should handle chunked input correctly', async () => {
      const chunk1 = `<?xml version="1.0"?>\n<tv>\n  <channel id="ch1">\n    <display-name>Chan`;
      const chunk2 = `nel 1</display-name>\n  </channel>\n  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">\n    <title>Show</title>\n  </programme>\n</tv>`;

      const items = [];
      for await (const item of parser.parseStream(createChunkedStream([chunk1, chunk2]))) {
        items.push(item);
      }

      expect(items).toHaveLength(2);
      expect(items[0].type).toBe('channel');
      expect(items[1].type).toBe('program');
    });

    it('should throw error for stream without <tv> element', async () => {
      const xml = `<?xml version="1.0"?><data><item>test</item></data>`;

      const items = [];
      await expect(async () => {
        for await (const item of parser.parseStream(createStream(xml))) {
          items.push(item);
        }
      }).rejects.toThrow('<tv> kök elemanı bulunamadı');
    });

    it('should yield multiple channels and programs', async () => {
      const xml = `<tv>
  <channel id="ch1"><display-name>Channel 1</display-name></channel>
  <channel id="ch2"><display-name>Channel 2</display-name></channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="ch1">
    <title>Show 1</title>
  </programme>
  <programme start="20240101130000 +0000" stop="20240101140000 +0000" channel="ch2">
    <title>Show 2</title>
  </programme>
</tv>`;

      const items = [];
      for await (const item of parser.parseStream(createStream(xml))) {
        items.push(item);
      }

      const channels = items.filter(i => i.type === 'channel');
      const programs = items.filter(i => i.type === 'program');

      expect(channels).toHaveLength(2);
      expect(programs).toHaveLength(2);
    });
  });
});
