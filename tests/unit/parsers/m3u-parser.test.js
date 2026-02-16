const { Readable } = require('stream');
const M3UParser = require('../../../src/parsers/M3UParser');

describe('M3UParser', () => {
  let parser;

  beforeEach(() => {
    parser = new M3UParser();
  });

  describe('parse()', () => {
    it('should parse a valid M3U with all attributes', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="epg1" tvg-name="Test Channel" tvg-logo="http://logo.png" group-title="Sports",Test Channel',
        'http://stream.example.com/live/1',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.channels[0]).toEqual({
        name: 'Test Channel',
        logo: 'http://logo.png',
        group: 'Sports',
        epgId: 'epg1',
        url: 'http://stream.example.com/live/1',
        extras: {},
      });
    });

    it('should parse multiple channels', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" tvg-logo="http://logo1.png" group-title="News",Channel 1',
        'http://stream.example.com/1',
        '#EXTINF:-1 tvg-id="ch2" tvg-name="Channel 2" tvg-logo="http://logo2.png" group-title="Sports",Channel 2',
        'http://stream.example.com/2',
        '#EXTINF:-1 tvg-id="ch3" tvg-name="Channel 3" tvg-logo="http://logo3.png" group-title="Movies",Channel 3',
        'http://stream.example.com/3',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.channels[0].name).toBe('Channel 1');
      expect(result.channels[1].name).toBe('Channel 2');
      expect(result.channels[2].name).toBe('Channel 3');
    });

    it('should throw error for missing #EXTM3U header', () => {
      const content = [
        '#EXTINF:-1 tvg-id="ch1",Channel 1',
        'http://stream.example.com/1',
      ].join('\n');

      expect(() => parser.parse(content)).toThrow('#EXTM3U başlığı eksik');
    });

    it('should throw error for empty content', () => {
      expect(() => parser.parse('')).toThrow('boş veya geçersiz');
      expect(() => parser.parse(null)).toThrow('boş veya geçersiz');
      expect(() => parser.parse(undefined)).toThrow('boş veya geçersiz');
    });

    it('should throw error for whitespace-only content', () => {
      expect(() => parser.parse('   \n  \n  ')).toThrow('boş veya geçersiz');
    });

    it('should report malformed #EXTINF lines as errors', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 this line has no comma',
        'http://stream.example.com/1',
        '#EXTINF:-1 tvg-id="ch2" tvg-name="Good Channel" group-title="News",Good Channel',
        'http://stream.example.com/2',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].name).toBe('Good Channel');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(2);
      expect(result.errors[0].message).toContain('Bozuk #EXTINF');
    });

    it('should report missing URL after #EXTINF as error', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" group-title="News",Channel 1',
        '#EXTINF:-1 tvg-id="ch2" tvg-name="Channel 2" group-title="Sports",Channel 2',
        'http://stream.example.com/2',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].name).toBe('Channel 2');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('URL bulunamadı');
    });

    it('should report error when file ends with #EXTINF but no URL', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" group-title="News",Channel 1',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('URL bulunamadı');
    });

    it('should capture extra/unknown attributes in extras', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel" tvg-logo="http://logo.png" group-title="News" catchup="default" catchup-source="http://catch.url" tvg-language="Turkish",Channel',
        'http://stream.example.com/1',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].extras).toEqual({
        catchup: 'default',
        'catchup-source': 'http://catch.url',
        'tvg-language': 'Turkish',
      });
    });

    it('should handle missing attributes gracefully', () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1,Minimal Channel',
        'http://stream.example.com/1',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0]).toEqual({
        name: 'Minimal Channel',
        logo: '',
        group: '',
        epgId: '',
        url: 'http://stream.example.com/1',
        extras: {},
      });
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const content = '#EXTM3U\r\n#EXTINF:-1 tvg-id="ch1",Channel 1\r\nhttp://stream.example.com/1\r\n';

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].name).toBe('Channel 1');
    });

    it('should skip non-EXTINF comment lines', () => {
      const content = [
        '#EXTM3U',
        '# This is a comment',
        '#EXTVLCOPT:some-option',
        '#EXTINF:-1 tvg-id="ch1",Channel 1',
        'http://stream.example.com/1',
      ].join('\n');

      const result = parser.parse(content);

      expect(result.channels).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parseStream()', () => {
    function createStream(content) {
      return Readable.from([content]);
    }

    it('should yield channels from a stream', async () => {
      const content = [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="ch1" tvg-name="Channel 1" tvg-logo="http://logo1.png" group-title="News",Channel 1',
        'http://stream.example.com/1',
        '#EXTINF:-1 tvg-id="ch2" tvg-name="Channel 2" tvg-logo="http://logo2.png" group-title="Sports",Channel 2',
        'http://stream.example.com/2',
      ].join('\n');

      const channels = [];
      for await (const channel of parser.parseStream(createStream(content))) {
        channels.push(channel);
      }

      expect(channels).toHaveLength(2);
      expect(channels[0].name).toBe('Channel 1');
      expect(channels[0].url).toBe('http://stream.example.com/1');
      expect(channels[1].name).toBe('Channel 2');
      expect(channels[1].url).toBe('http://stream.example.com/2');
    });

    it('should throw error for missing header in stream', async () => {
      const content = [
        '#EXTINF:-1 tvg-id="ch1",Channel 1',
        'http://stream.example.com/1',
      ].join('\n');

      const channels = [];
      await expect(async () => {
        for await (const channel of parser.parseStream(createStream(content))) {
          channels.push(channel);
        }
      }).rejects.toThrow('#EXTM3U başlığı eksik');
    });

    it('should handle chunked input correctly', async () => {
      const chunk1 = '#EXTM3U\n#EXTINF:-1 tvg-id="ch1" tvg-name="Chan';
      const chunk2 = 'nel 1" group-title="News",Channel 1\nhttp://stream.example.com/1\n';

      const stream = Readable.from([chunk1, chunk2]);

      const channels = [];
      for await (const channel of parser.parseStream(stream)) {
        channels.push(channel);
      }

      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('Channel 1');
      expect(channels[0].url).toBe('http://stream.example.com/1');
    });
  });
});
