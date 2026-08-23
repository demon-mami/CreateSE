import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const args = process.argv.slice(2);
const valueAfter = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const host = valueAfter('--host') || '0.0.0.0';
const port = Number(valueAfter('--port')) || 4173;
const root = process.cwd();
const production = 'https://demon-mami.github.io/CreateSE';
const redirects = new Set(['/maps.zip', '/hitsounds-current111-abc-v5.zip']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
};

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (redirects.has(url.pathname)) {
    response.writeHead(302, { Location: `${production}${url.pathname}` });
    response.end();
    return;
  }
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
  const path = join(root, relative);
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': types[extname(path).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(path).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(`CreateSE preview: http://${host}:${port}\n`);
});
