const XMLTVFormatter = require('../../../src/parsers/XMLTVFormatter');

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk.toString());
  return chunks.join('');
}

describe('XMLTVFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new XMLTVFormatter();
  });

  test('escapes provider data, removes invalid XML controls and preserves emoji', async () => {
    const invalid = '\u0000\u0001\u0008\u000B\u000C\u001F';
    const channels = [{
      id: `id&<>"'${invalid}😀`,
      name: `News & <World> "Today" 'Live'${invalid} 📺`,
      icon: `https://logo.example/a?x=1&y="2"${invalid}`,
    }];
    async function* programmes() {
      yield {
        start: new Date('2026-07-28T12:34:56.999Z'),
        stop: new Date('2026-07-28T13:34:56.000Z'),
        channelId: channels[0].id,
        title: `</title><injected attr="yes"> & " '${invalid} 🎬`,
        description: `A > B & C < D "quoted" 'apostrophe'${invalid}`,
      };
    }

    const xml = await read(formatter.formatStream(channels, programmes()));

    expect(xml).toContain('id="id&amp;&lt;&gt;&quot;&apos;😀"');
    expect(xml).toContain('News &amp; &lt;World&gt; &quot;Today&quot; &apos;Live&apos; 📺');
    expect(xml).toContain('&lt;/title&gt;&lt;injected attr=&quot;yes&quot;&gt;');
    expect(xml).toContain('start="20260728123456 +0000"');
    expect(xml).toContain('stop="20260728133456 +0000"');
    expect(xml).not.toMatch(/[\u0000\u0001\u0008\u000B\u000C\u001F]/);
    expect(xml.match(/<title>/g)).toHaveLength(1);
    expect(xml.trim().endsWith('</tv>')).toBe(true);
  });

  test('omits an unknown stop time and optional description', async () => {
    async function* programmes() {
      yield { start: '2026-01-02T03:04:05Z', stop: null, channelId: 'same.id', title: 'Title' };
    }
    const xml = await read(formatter.formatStream(
      [{ id: 'same.id', name: 'Channel', icon: null }],
      programmes()
    ));
    expect(xml).toContain('<programme start="20260102030405 +0000" channel="same.id">');
    expect(xml).not.toContain(' stop=');
    expect(xml).not.toContain('<desc>');
  });

  test('rejects invalid timestamps instead of emitting malformed XMLTV dates', () => {
    expect(() => formatter.formatProgramme({
      start: 'not-a-date',
      channelId: 'channel',
      title: 'Title',
    })).toThrow('Invalid XMLTV timestamp');
  });
});
