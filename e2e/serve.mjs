// Serves the worksheet the way Pages does: index.html at the site root, nothing else.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';

const port = Number(process.argv[2] || 4178);
const page = new URL('../index.html', import.meta.url);
createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/' && path !== '/index.html') {
    res.writeHead(404, {'content-type': 'text/plain'});
    res.end('Not found');
    return;
  }
  res.writeHead(200, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'});
  res.end(readFileSync(page));
}).listen(port, '127.0.0.1');
