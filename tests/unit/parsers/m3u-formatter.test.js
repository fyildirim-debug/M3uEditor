const { Readable } = require('stream');
const M3UFormatter = require('../../../src/parsers/M3UFormatter');
const M3UParser = require('../../../src/parsers/M3UParser');

describe('M3UFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new M3UFormatter();
  });

  describe('format()', () => {
    it('should format a single channel with all attributes', () => {
      const channels = [
        {
          name: 'Test Channel',
          logo: 'http://logo.png',
          group: 'Sports',
          epgId: 'epg1',
          url: 'http://stream.example.com/live/1',
          extras: {},
        },
      ];

      const result = formatter.format(channels);

      expect(result).toContain('#EXTM3U');
      expect(result).toContain('tvg-id="epg1"');
      expect(result).toContain('tvg-name="Test Channel"');
      expect(result).toContain('tvg-logo="http://logo.png"');
      expect(result).toContain('group-title="Sports"');
      expect(result).toContain(',Test Channel');
      expect(result).toContain('http://stream.example.com/live/1');
    });

    it('should format multiple channels', () => {
      const channels = [
        { name: 'Channel 1', logo: '', group: 'News', epgId: 'ch1', url: 'http://stream.example.com/1', extras: {} },
        { name: 'Channel 2', logo: '', group: 'Sports', epgId: 'ch2', url: 'http://stream.example.com/2', extras: {} },
        { name: 'Channel 3', logo: '', group: 'Movies', epgId: 'ch3', url: 'http://stream.example.com/3', extras: {} },
      ];

      const result = formatter.format(channels);
      const lines = result.split('\n').filter(l => l !== '');

      // #EXTM3U + 3 channels * 2 lines each = 7 lines
      expect(lines).toHaveLength(7);
      expect(lines[0]).toBe('#EXTM3U');
    });

    it('should produce just #EXTM3U header for empty channel list', () => {
      const result = formatter.format([]);

      expect(result.trim()).toBe('#EXTM3U');
    });

    it('should omit missing/empty attributes from output', () => {
      const channels = [
        { name: 'Minimal', logo: '', group: '', epgId: '', url: 'http://stream.example.com/1', extras: {} },
      ];

      const result = formatter.format(channels);

      expect(result).not.toContain('tvg-id=');
      expect(result).not.toContain('tvg-logo=');
      expect(result).not.toContain('group-title=');
      expect(result).toContain('tvg-name="Minimal"');
      expect(result).toContain(',Minimal');
    });

    it('should include extras as additional attributes', () => {
      const channels = [
        {
          name: 'Channel',
          logo: 'http://logo.png',
          group: 'News',
          epgId: 'ch1',
          url: 'http://stream.example.com/1',
          extras: {
            catchup: 'default',
            'catchup-source': 'http://catch.url',
            'tvg-language': 'Turkish',
          },
        },
      ];

      const result = formatter.format(channels);

      expect(result).toContain('catchup="default"');
      expect(result).toContain('catchup-source="http://catch.url"');
      expect(result).toContain('tvg-language="Turkish"');
    });

    it('should omit extras with empty values', () => {
      const channels = [
        {
          name: 'Channel',
          logo: '',
          group: '',
          epgId: '',
          url: 'http://stream.example.com/1',
          extras: { catchup: 'default', empty: '' },
        },
      ];

      const result = formatter.format(channels);

      expect(result).toContain('catchup="default"');
      expect(result).not.toContain('empty=');
    });
  });

  describe('formatStream()', () => {
    it('should produce correct output from async iterable', async () => {
      async function* channelGenerator() {
        yield { name: 'Channel 1', logo: 'http://logo1.png', group: 'News', epgId: 'ch1', url: 'http://stream.example.com/1', extras: {} };
        yield { name: 'Channel 2', logo: 'http://logo2.png', group: 'Sports', epgId: 'ch2', url: 'http://stream.example.com/2', extras: {} };
      }

      const stream = formatter.formatStream(channelGenerator());
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk.toString());
      }
      const result = chunks.join('');

      expect(result).toContain('#EXTM3U');
      expect(result).toContain('tvg-id="ch1"');
      expect(result).toContain('http://stream.example.com/1');
      expect(result).toContain('tvg-id="ch2"');
      expect(result).toContain('http://stream.example.com/2');
    });

    it('should produce just header for empty iterable', async () => {
      async function* emptyGenerator() {}

      const stream = formatter.formatStream(emptyGenerator());
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk.toString());
      }
      const result = chunks.join('');

      expect(result.trim()).toBe('#EXTM3U');
    });
  });

  describe('round-trip: parse(format(channels))', () => {
    it('should produce equivalent channels after round-trip', () => {
      const parser = new M3UParser();
      const original = [
        {
          name: 'Test Channel',
          logo: 'http://logo.png',
          group: 'Sports',
          epgId: 'epg1',
          url: 'http://stream.example.com/live/1',
          extras: { catchup: 'default' },
        },
        {
          name: 'Another Channel',
          logo: 'http://logo2.png',
          group: 'News',
          epgId: 'epg2',
          url: 'http://stream.example.com/live/2',
          extras: {},
        },
      ];

      const m3uContent = formatter.format(original);
      const { channels } = parser.parse(m3uContent);

      expect(channels).toHaveLength(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(channels[i].name).toBe(original[i].name);
        expect(channels[i].logo).toBe(original[i].logo);
        expect(channels[i].group).toBe(original[i].group);
        expect(channels[i].epgId).toBe(original[i].epgId);
        expect(channels[i].url).toBe(original[i].url);
        expect(channels[i].extras).toEqual(original[i].extras);
      }
    });
  });
});
