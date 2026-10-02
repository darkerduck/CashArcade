import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
    try {
        let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (file !== root.slice(0, -1) && !file.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Outside root');
        if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
        const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.argv[2] || 4184), '127.0.0.1', () => console.log(`CashArcade preview: http://127.0.0.1:${process.argv[2] || 4184}/`));
