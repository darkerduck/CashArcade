import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
    let relative;try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/CashArcade(?=\/|$)/,'');}catch{res.writeHead(400).end();return;}
    let file=path.resolve(root,'.'+(relative||'/'));
    if(file!==path.resolve(root)&&!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('CashArcade preview: http://127.0.0.1:4173/CashArcade/arena/'));
