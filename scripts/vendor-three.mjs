// Reproducible, mechanical copy from the official three@0.186.0 npm archive.
// Usage: node scripts/vendor-three.mjs /path/to/extracted/package
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = resolve(process.argv[2] || '');
const destination = fileURLToPath(new URL('../vendor/three-r186/', import.meta.url));
if (JSON.parse(readFileSync(resolve(source, 'package.json'), 'utf8')).version !== '0.186.0') throw new Error('Expected three@0.186.0');
const copied = new Set();
function copy(path) {
    if (copied.has(path)) return;
    if (path.startsWith('..')) throw new Error('Dependency outside package');
    copied.add(path);
    const input = resolve(source, path), output = resolve(destination, path);
    mkdirSync(dirname(output), { recursive: true }); copyFileSync(input, output);
    if (!path.endsWith('.js')) return;
    for (const match of readFileSync(input, 'utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        if (match[1].startsWith('.')) copy(relative(source, resolve(dirname(input), match[1])));
        else if (match[1].startsWith('three/addons/')) copy(match[1].replace('three/addons/', 'examples/jsm/'));
        else if (match[1] !== 'three') throw new Error(`Unexpected dependency ${match[1]}`);
    }
}
for (const path of ['LICENSE', 'build/three.module.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/geometries/RoundedBoxGeometry.js',
    'examples/jsm/objects/Reflector.js', 'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/RenderPass.js',
    'examples/jsm/postprocessing/UnrealBloomPass.js', 'examples/jsm/postprocessing/OutputPass.js']) copy(path);
console.log(`Vendored ${copied.size} files from three@0.186.0`);
