const net = require('net');

/** Verilen port bossa onu, degilse isletim sisteminin sectigi bos bir portu dondurur. */
function freePort(preferred) {
  const tryPort = (port) => new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(null));
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      const { port: actual } = server.address();
      server.close(() => resolve(actual));
    });
  });
  return (async () => {
    if (preferred) {
      const port = await tryPort(preferred);
      if (port) return port;
    }
    return tryPort(0);
  })();
}

module.exports = { freePort };
