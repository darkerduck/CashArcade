import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POWERS, distance } from './levels.mjs';

const CYAN = '#42f8ef', GREEN = '#45ffa5', PINK = '#fd61d7', GOLD = '#ffd35b';
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const glowing = (color, intensity = 1.6, opacity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
const metal = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, metalness: .52, roughness: .26, clearcoat: 1, clearcoatRoughness: .15, ...extra });

function texture(draw, width = 256, height = 256) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); group.add(m); return m;
}
function tube(group, points, radius, material) {
    return mesh(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 12, radius, 5, false), material);
}

export class SnakeRenderer {
    constructor(canvas, { onLost = () => {}, onRestored = () => {} } = {}) {
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
        if (!gl) throw new Error('這台瀏覽器無法啟用 WebGL2。請啟用硬體加速或使用新版 Chrome／Safari。尚未開始遊戲或付款。');
        this.canvas = canvas; this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
        this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
        this.renderer.info.autoReset = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#040817'); this.scene.fog = new THREE.FogExp2('#07132d', .018);
        this.camera = new THREE.PerspectiveCamera(40, 1, .1, 140);
        this.controls = new OrbitControls(this.camera, canvas); this.controls.enabled = false; this.controls.enablePan = false;
        this.controls.minPolarAngle = .18; this.controls.maxPolarAngle = Math.PI * .48;
        this.controls.enableDamping = false; this.controls.minDistance = 10; this.controls.maxDistance = 46;
        this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(400, 400), .63, .58, .9); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
        this.low = innerWidth < 600; this.slowFrames = 0; this.visualTime = 0; this.particles = []; this.rings = []; this.bolts = [];
        this.rounded = new RoundedBoxGeometry(.82, .78, .82, 3, .14); this.unit = new THREE.BoxGeometry(1, 1, 1);
        this.scene.add(new THREE.HemisphereLight('#beeaff', '#142249', 1.15));
        const key = new THREE.DirectionalLight('#ddfffa', 2); key.position.set(4, 14, 8); this.scene.add(key);
        const rim = new THREE.DirectionalLight('#cf6eff', 1.6); rim.position.set(-9, 5, -6); this.scene.add(rim);
        const environment = texture((c, w, h) => {
            const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#05102d'); bg.addColorStop(.4, '#405b70'); bg.addColorStop(1, '#0c0926');
            c.fillStyle = bg; c.fillRect(0, 0, w, h);
            for (const [x, color] of [[20, '#a4fff0'], [100, '#fafcff'], [190, '#b387ff']]) { c.fillStyle = color; c.fillRect(x, 12, 12, h - 24); }
        }, 256, 128);
        environment.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(this.renderer); this.environment = pmrem.fromEquirectangular(environment); this.scene.environment = this.environment.texture;
        pmrem.dispose(); environment.dispose();
        this.world = new THREE.Group(); this.scene.add(this.world);
        this.fx = new THREE.Group(); this.scene.add(this.fx);
        this.makeParticles();
        this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; onLost(); });
        canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.resize(); onRestored(); });
    }
    point(p) { return new THREE.Vector3(p.x - (this.level.width - 1) / 2, p.y + .56, p.z - (this.level.depth - 1) / 2); }
    clearWorld() {
        const geometries = new Set(), materials = new Set();
        this.world.traverse(o => { if (o.geometry && o.geometry !== this.unit && o.geometry !== this.rounded) geometries.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); });
        geometries.forEach(g => g.dispose()); materials.forEach(m => { if (m.map && m.map !== this.environment.texture) m.map.dispose(); m.dispose(); });
        this.reflector?.getRenderTarget().dispose(); this.world.clear();
        this.rings.forEach(r => { r.mesh.geometry.dispose(); r.mesh.material.dispose(); });
        this.bolts.forEach(b => { b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
        this.fx.clear(); this.rings = []; this.bolts = []; this.particles = []; this.visualTime = 0;
    }
    load(game) {
        this.clearWorld(); this.level = game.level; this.lastTheme = null; this.heading = null;
        const { width: w, depth: d, height: h } = this.level;
        const plate = metal('#091628', { roughness: .2, metalness: .85 });
        const base = mesh(this.world, this.unit, plate, 0, -.37, 0); base.scale.set(w + .7, .65, d + .7);
        this.reflector = new Reflector(new THREE.PlaneGeometry(w + .3, d + .3), { color: 0x182a3a, textureWidth: 512, textureHeight: 512, clipBias: .003 });
        this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.y = -.035; this.reflector.visible = !this.low; this.world.add(this.reflector);
        const grid = new THREE.GridHelper(w, w, '#3ea6c4', '#246580'); grid.position.y = .012; grid.material.transparent = true; grid.material.opacity = .5; this.world.add(grid);
        const outline = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + .05, h, d + .05));
        const cage = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: '#448cac', transparent: true, opacity: .19 })); cage.position.y = h / 2; this.world.add(cage);
        for (const [x, z, sx, sz, color] of [[0, -d / 2, w, .06, PINK], [0, d / 2, w, .06, CYAN], [-w / 2, 0, .06, d, CYAN], [w / 2, 0, .06, d, PINK]]) {
            const edge = mesh(this.world, this.unit, glowing(color, 2.2), x, .03, z); edge.scale.set(sx, .065, sz);
        }
        this.layerGrid = new THREE.GridHelper(w, w, CYAN, '#1b7186'); this.layerGrid.material.transparent = true; this.layerGrid.material.opacity = .13; this.layerGrid.material.depthWrite = false; this.world.add(this.layerGrid);
        this.makeCity();
        const wallGeo = new RoundedBoxGeometry(.94, .94, .94, 2, .045);
        this.walls = new THREE.InstancedMesh(wallGeo, metal('#203149', { emissive: '#071c33', emissiveIntensity: .5 }), Math.max(1, this.level.walls.length));
        this.ghostWalls = new THREE.InstancedMesh(wallGeo, new THREE.MeshBasicMaterial({ color: '#6ca3c8', transparent: true, opacity: .1, wireframe: true, depthWrite: false }), Math.max(1, this.level.walls.length));
        this.walls.frustumCulled = this.ghostWalls.frustumCulled = false;
        this.world.add(this.walls, this.ghostWalls);
        this.shells = new THREE.InstancedMesh(this.rounded, metal('#51fbd3', { metalness: .08, roughness: .13, transmission: this.low ? 0 : .55, thickness: .65, emissive: '#047a66', emissiveIntensity: .45 }), 128);
        this.cores = new THREE.InstancedMesh(new RoundedBoxGeometry(.63, .58, .63, 2, .13), glowing('#ffffff', 1), 128);
        this.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shells.frustumCulled = this.cores.frustumCulled = false; this.world.add(this.shells, this.cores);
        this.makeHead();
        this.food = this.makeFood(); this.dessert = this.makeCake(); this.bombs = Array.from({ length: 3 }, () => this.makeBomb());
        this.powerModels = Object.fromEntries(Object.keys(POWERS).map(kind => [kind, this.makePower(kind)]));
        this.portalModels = this.level.portals.flatMap(pair => [this.makePortal(pair.a, pair.color), this.makePortal(pair.b, pair.color)]);
        this.exit = this.makePortal(this.level.exit, GREEN); this.exit.scale.setScalar(1.15);
        this.exitBeam = mesh(this.exit, new THREE.CylinderGeometry(.06, .45, 2.4, 20, 1, true), glowing(GREEN, 1.3, .18), 0, .8, 0);
        this.gateModels = this.level.gates.map(gate => gate.cells.map(p => {
            const group = new THREE.Group(); group.position.copy(this.point(p));
            const beam = mesh(group, this.unit, glowing('#ff435b', 2), 0, 0, 0); beam.scale.set(.86, .11, .15);
            const ring = mesh(group, new THREE.TorusGeometry(.44, .025, 5, 16), glowing('#ff435b', 1.5)); ring.rotation.x = Math.PI / 2;
            this.world.add(group); return group;
        }));
        this.targetBeam = mesh(this.world, new THREE.CylinderGeometry(.008, .025, 1, 6), glowing(GOLD, 1.4, .55));
        this.shadow = mesh(this.world, new THREE.RingGeometry(.28, .38, 32), glowing(CYAN, 1.5, .7)); this.shadow.rotation.x = -Math.PI / 2;
        this.slowRing = mesh(this.world, new THREE.TorusGeometry(w * .48, .028, 6, 96), glowing('#b590ff', 1.8, .5)); this.slowRing.rotation.x = Math.PI / 2;
        this.resetCamera(); this.resize(); this.draw(game, 0);
    }
    makeHead() {
        this.head = new THREE.Group();
        const outer = mesh(this.head, new RoundedBoxGeometry(.93, .87, .93, 4, .19), metal('#41fce0', { roughness: .1, metalness: .14, transmission: this.low ? 0 : .18, emissive: '#0b8f79', emissiveIntensity: .5 }));
        mesh(this.head, new RoundedBoxGeometry(.7, .65, .13, 3, .12), metal('#052e30', { roughness: .18 }), 0, 0, .423);
        const rim = new THREE.LineSegments(new THREE.EdgesGeometry(outer.geometry, 28), new THREE.LineBasicMaterial({ color: '#79ffff', transparent: true, opacity: .7, depthTest: false })); rim.renderOrder = 5; this.head.add(rim);
        for (const x of [-.17, .17]) mesh(this.head, new THREE.CapsuleGeometry(.048, .21, 4, 8), glowing('#aefff1', 3), x, .045, .508);
        const mouth = mesh(this.head, this.unit, glowing('#43ffbb', 2), 0, -.21, .501); mouth.scale.set(.15, .022, .025);
        this.shield = mesh(this.head, new THREE.IcosahedronGeometry(.7, 1), new THREE.MeshBasicMaterial({ color: '#85ffe4', wireframe: true, transparent: true, opacity: .45, depthWrite: false }));
        this.magnetRing = mesh(this.head, new THREE.TorusGeometry(.72, .028, 6, 36), glowing(GOLD, 2)); this.magnetRing.rotation.x = Math.PI / 2;
        this.world.add(this.head);
    }
    makeFood() {
        const group = new THREE.Group();
        mesh(group, new RoundedBoxGeometry(.58, .58, .58, 3, .09), metal('#ffce47', { metalness: .12, roughness: .09, transmission: .12, emissive: '#e7810a', emissiveIntensity: .85 }));
        const core = mesh(group, new THREE.OctahedronGeometry(.18), glowing('#fff7c5', 3)); core.rotation.z = .3;
        mesh(group, new THREE.TorusGeometry(.45, .015, 6, 32), glowing(GOLD, 2)).rotation.x = Math.PI / 2;
        this.world.add(group); return group;
    }
    makeCake() {
        const group = new THREE.Group();
        mesh(group, new RoundedBoxGeometry(.7, .32, .6, 2, .05), metal('#f14a96', { emissive: '#862263', emissiveIntensity: .55 }), 0, -.01, 0);
        mesh(group, new RoundedBoxGeometry(.73, .08, .63, 2, .03), glowing('#ffd6b7', 1), 0, -.17, 0);
        mesh(group, new RoundedBoxGeometry(.75, .14, .65, 2, .05), metal('#ffc9ef', { emissive: '#d664bd', emissiveIntensity: .6 }), 0, .2, 0);
        for (const x of [-.24, 0, .24]) mesh(group, new THREE.SphereGeometry(.075, 10, 8), glowing('#ffd3f4', 1.1), x, .11, .31);
        mesh(group, new THREE.SphereGeometry(.11, 16, 12), metal('#ff306a', { emissive: '#df1547', emissiveIntensity: .7 }), 0, .39, 0);
        tube(group, [[0, .44, 0], [.02, .58, 0], [.09, .62, 0]], .012, glowing('#71ffa2', 1.2));
        this.world.add(group); return group;
    }
    makeBomb() {
        const group = new THREE.Group();
        mesh(group, new THREE.SphereGeometry(.34, 24, 20), metal('#101325', { metalness: .86, roughness: .18 }));
        mesh(group, new THREE.CylinderGeometry(.075, .11, .13, 12), metal('#591d31'), 0, .34, 0);
        mesh(group, new THREE.TorusGeometry(.337, .018, 6, 32), glowing('#ff3558', 1.6)).rotation.x = Math.PI / 2;
        tube(group, [[0, .39, 0], [.03, .58, 0], [.17, .61, 0]], .025, metal('#ae6b34'));
        const spark = mesh(group, new THREE.OctahedronGeometry(.085), glowing('#ffb3bd', 4), .17, .62, 0);
        group.userData.spark = spark; this.world.add(group); return group;
    }
    makePower(kind) {
        const { color, glyph } = POWERS[kind], group = new THREE.Group();
        mesh(group, new THREE.OctahedronGeometry(.42), metal(color, { emissive: color, emissiveIntensity: .35, metalness: .2, roughness: .15 }));
        const tex = texture((c, w, h) => { c.fillStyle = '#ffffff'; c.font = `bold ${w * .7}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, w / 2, h / 2); }, 64, 64);
        const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffffff', depthTest: false })); icon.scale.set(.43, .43, 1); icon.position.y = .05; icon.renderOrder = 6; group.add(icon);
        const ring = mesh(group, new THREE.TorusGeometry(.52, .022, 6, 32), glowing(color, 1.8)); ring.rotation.x = Math.PI / 2;
        this.world.add(group); return group;
    }
    makePortal(at, color) {
        const group = new THREE.Group(); group.position.copy(this.point(at));
        mesh(group, new THREE.TorusGeometry(.48, .045, 8, 48), glowing(color, 2));
        const inner = mesh(group, new THREE.TorusGeometry(.36, .016, 6, 32), glowing(color, 2)); inner.rotation.y = .55;
        const plinth = mesh(group, this.unit, metal('#26324a', { emissive: color, emissiveIntensity: .25 }), 0, -.4, 0); plinth.scale.set(.85, .12, .55);
        this.world.add(group); return group;
    }
    makeCity() {
        const { width: w, depth: d } = this.level;
        const buildings = new THREE.InstancedMesh(this.unit, metal('#0b1730', { metalness: .65, roughness: .24 }), 36);
        const lights = new THREE.InstancedMesh(this.unit, glowing('#ffffff', 1.8), 180);
        const dummy = new THREE.Object3D(); let lightCount = 0;
        for (let i = 0; i < 36; i++) {
            const side = i % 4, v = Math.sin(i * 13.13) * .5 + .5, length = w + 8;
            const a = (Math.floor(i / 4) / 8 - .5) * length, edge = w / 2 + 2 + v * 3;
            const x = side === 0 ? -edge : side === 1 ? edge : a, z = side === 2 ? -edge : side === 3 ? edge : a;
            const height = z > 0 ? .7 + v * 1.6 : 2 + v * 5;
            dummy.position.set(x, height / 2 - 1.2, z); dummy.scale.set(.8 + v, height, .8 + v); dummy.updateMatrix(); buildings.setMatrixAt(i, dummy.matrix);
            for (let j = 0; j < 5; j++) {
                dummy.position.set(x - .2 + j % 2 * .4, -.7 + height * ((j + 1) / 6), z + .51 + v * .5);
                dummy.scale.set(.045, .26, .025); dummy.updateMatrix(); lights.setMatrixAt(lightCount, dummy.matrix); lights.setColorAt(lightCount++, new THREE.Color(i % 2 ? PINK : CYAN));
            }
        }
        lights.count = lightCount; this.world.add(buildings, lights);
        const starGeo = new THREE.BufferGeometry(), stars = [];
        for (let i = 0; i < 420; i++) stars.push(Math.sin(i * 12.9898) * 35, 4 + (Math.cos(i * 4.23) + 1) * 11, -12 - (Math.sin(i * 3.17) + 1) * 18);
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3)); this.world.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#95bcff', size: .065, transparent: true, opacity: .65 })));
        const planet = mesh(this.world, new THREE.SphereGeometry(2.7, 40, 32), metal('#293f9a', { roughness: .8, emissive: '#3d2663', emissiveIntensity: .7 }), -w * .95, 7.5, -d - 8);
        const halo = mesh(this.world, new THREE.TorusGeometry(3.5, .035, 6, 64), glowing('#9d65ef', 1.2, .4), ...planet.position.toArray()); halo.rotation.set(1.1, .2, -.4);
    }
    makeParticles() {
        this.particleGeo = new THREE.BufferGeometry(); this.particlePositions = new Float32Array(512 * 3); this.particleColors = new Float32Array(512 * 3);
        this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
        this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3).setUsage(THREE.DynamicDrawUsage));
        const t = texture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff'); g.addColorStop(.35, '#fff'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 32, 32);
        this.particleMesh = new THREE.Points(this.particleGeo, new THREE.PointsMaterial({ map: t, vertexColors: true, size: .105, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.particleMesh.frustumCulled = false; this.scene.add(this.particleMesh);
    }
    burst(at, color, count = 25) {
        const origin = this.point(at), rgb = new THREE.Color(color).multiplyScalar(2);
        if (this.reduced.matches) count = Math.ceil(count * .25);
        for (let i = 0; i < count && this.particles.length < (this.low ? 150 : 512); i++) {
            const angle = i * 2.39996, speed = .5 + (i % 7) * .2;
            this.particles.push({ p: origin.clone(), v: new THREE.Vector3(Math.cos(angle) * speed, .5 + (i % 5) * .3, Math.sin(angle) * speed), rgb, life: .6 + (i % 4) * .12, max: 1 });
        }
    }
    ring(at, color, size = 2, seconds = .65) {
        if (this.rings.length >= 12) return;
        const m = mesh(this.fx, new THREE.TorusGeometry(.4, .026, 6, 48), glowing(color, 2, .8)); m.position.copy(this.point(at)); m.rotation.x = Math.PI / 2;
        this.rings.push({ mesh: m, age: 0, life: seconds, size });
    }
    bolt(from, to, color) {
        if (this.bolts.length >= 16) return;
        const a = this.point(from), b = this.point(to), points = [];
        for (let i = 0; i <= 8; i++) { const p = a.clone().lerp(b, i / 8); if (i > 0 && i < 8) p.add(new THREE.Vector3(Math.sin(i * 6.2) * .25, Math.cos(i * 3) * .3, Math.sin(i * 5) * .3)); points.push(p); }
        const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 1 }));
        this.fx.add(m); this.bolts.push({ mesh: m, age: 0, life: .45 });
    }
    events(events, game) {
        for (const event of events) {
            if (!event.at) continue;
            if (event.type === 'eat') { this.burst(event.at, event.kind === 'food' ? GOLD : PINK); this.ring(event.at, event.kind === 'food' ? GOLD : PINK); if (event.magnetic) this.bolt(event.at, game.snake[0], GOLD); }
            if (event.type === 'portal') { this.ring(event.at, '#af8bff'); this.ring(event.target, '#af8bff'); this.burst(event.target, '#af8bff', 18); }
            if (event.type === 'power') {
                const color = POWERS[event.kind].color; this.burst(event.at, color, 45); this.ring(event.at, color, event.kind === 'emp' ? this.level.width * 2 : 3.5, 1.1);
                if (event.kind === 'emp') for (const target of event.targets) this.bolt(event.at, target, color);
                if (event.kind === 'shrink') this.burst(game.snake.at(-1), color, 35);
            }
            if (event.type === 'shield-hit') { this.burst(event.at, CYAN, 45); this.ring(event.at, CYAN, 2.5); }
            if (event.type === 'lose') { this.burst(game.snake[0], event.reason === 'bomb' ? '#ff536e' : PINK, 60); this.ring(game.snake[0], '#ff537a', 3); }
            if (['level-clear', 'won', 'exit-open'].includes(event.type)) { this.ring(event.at, GREEN, 4, 1); this.burst(event.at, GREEN, 45); }
        }
    }
    advanceFx(delta) {
        this.visualTime += delta;
        this.particles = this.particles.filter(p => { p.life -= delta; p.p.addScaledVector(p.v, delta); p.v.y -= delta * .65; return p.life > 0; });
        for (const list of [this.rings, this.bolts]) for (let i = list.length - 1; i >= 0; i--) {
            const effect = list[i]; effect.age += delta;
            if (effect.size) effect.mesh.scale.setScalar(.3 + effect.age / effect.life * effect.size);
            effect.mesh.material.opacity = Math.max(0, 1 - effect.age / effect.life) * .75;
            if (effect.age >= effect.life) { this.fx.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose(); list.splice(i, 1); }
        }
    }
    resetCamera() {
        if (!this.level) return;
        const w = this.level.width, ratio = Math.max(.5, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
        this.controls.target.set(0, this.level.height * .4, 0);
        this.camera.position.copy(this.controls.target).add(new THREE.Vector3(.82, 1.12, 1.15).multiplyScalar(w));
        this.camera.aspect = ratio; this.camera.updateProjectionMatrix(); this.controls.update();
        // Fit every corner of the closed volume, including the front edge and ceiling.
        const corners = [];
        for (const x of [-w / 2 - .5, w / 2 + .5]) for (const y of [-.5, this.level.height + .25]) for (const z of [-w / 2 - .5, w / 2 + .5]) corners.push(new THREE.Vector3(x, y, z));
        for (let i = 0; i < 16; i++) {
            this.camera.updateMatrixWorld();
            if (corners.every(p => { const n = p.clone().project(this.camera); return Math.abs(n.x) <= .89 && Math.abs(n.y) <= .88; })) break;
            this.camera.position.sub(this.controls.target).multiplyScalar(1.06).add(this.controls.target); this.controls.update();
        }
    }
    survey(enabled) { this.controls.enabled = enabled; if (!enabled) this.resetCamera(); }
    rotateSurvey() {
        if (!this.controls.enabled) return;
        this.camera.position.sub(this.controls.target).applyAxisAngle(UP, Math.PI / 8).add(this.controls.target);
        this.controls.update();
    }
    resize() {
        const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.low ? 1.25 : 1.75)); this.renderer.setSize(width, height, false);
        this.composer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
        if (!this.controls.enabled) this.resetCamera();
    }
    setLow() {
        if (this.low) return; this.low = true; this.reflector.visible = false; this.shells.material.transmission = 0; this.shells.material.needsUpdate = true;
        this.bloom.strength = .45; this.resize();
    }
    async ready() { await this.renderer.compileAsync(this.scene, this.camera); }
    draw(game, delta = 0) {
        if (this.lost || !this.level) return;
        if (delta > 0) this.advanceFx(Math.min(delta, .1));
        const t = this.reduced.matches ? 0 : this.visualTime, alpha = ['running', 'paused'].includes(game.state) ? Math.min(1, game.moveElapsed / game.delay()) : 1;
        const dummy = new THREE.Object3D(), color = new THREE.Color();
        const interpolated = i => {
            const current = game.snake[i], before = game.previous[i] || current;
            return distance(current, before) > 1 ? this.point(current) : this.point(before).lerp(this.point(current), alpha);
        };
        this.head.position.copy(interpolated(0));
        const heading = `${game.direction.x},${game.direction.y},${game.direction.z}`;
        if (heading !== this.heading) {
            this.turnFrom = this.head.quaternion.clone();
            this.turnTo = new THREE.Quaternion().setFromUnitVectors(FRONT, new THREE.Vector3(game.direction.x, game.direction.y, game.direction.z));
            this.turnAge = this.heading === null ? .12 : 0; this.heading = heading;
        }
        this.turnAge += delta;
        this.head.quaternion.slerpQuaternions(this.turnFrom, this.turnTo, this.reduced.matches ? 1 : Math.min(1, this.turnAge / .12));
        this.shield.visible = game.effects.shield || game.effects.immune > game.time; this.shield.rotation.y = t * .4;
        this.magnetRing.visible = game.effects.magnet > game.time;
        const count = Math.min(127, game.snake.length - 1); this.shells.count = this.cores.count = count;
        for (let i = 0; i < count; i++) {
            dummy.position.copy(interpolated(i + 1)); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            this.shells.setMatrixAt(i, dummy.matrix); this.cores.setMatrixAt(i, dummy.matrix);
            color.set(i % 2 ? '#25dfaa' : '#22bcd5'); this.shells.setColorAt(i, color);
            color.set(i % 2 ? '#20ee91' : '#19d6dd').multiplyScalar(1.05); this.cores.setColorAt(i, color);
        }
        this.shells.instanceMatrix.needsUpdate = this.cores.instanceMatrix.needsUpdate = true;
        if (count) this.shells.instanceColor.needsUpdate = this.cores.instanceColor.needsUpdate = true;
        let solid = 0, ghost = 0;
        for (const p of this.level.walls) {
            dummy.position.copy(this.point(p)); dummy.updateMatrix();
            if (p.y > game.snake[0].y && distance(p, game.snake[0]) < 7) this.ghostWalls.setMatrixAt(ghost++, dummy.matrix);
            else this.walls.setMatrixAt(solid++, dummy.matrix);
        }
        this.walls.count = solid; this.ghostWalls.count = ghost; this.walls.instanceMatrix.needsUpdate = this.ghostWalls.instanceMatrix.needsUpdate = true;
        const item = (model, p, bob = true) => { model.visible = !!p; if (p) { model.position.copy(this.point(p)); if (bob) model.position.y += Math.sin(t * 2.8) * .055; } };
        item(this.food, game.food); this.food.rotation.y = t * .7;
        item(this.dessert, game.dessert); this.dessert.rotation.y = Math.sin(t) * .12;
        this.bombs.forEach((m, i) => { item(m, game.bombs[i], false); m.userData.spark.rotation.z = t * 3; m.userData.spark.scale.setScalar(1 + Math.sin(t * 8) * .16); });
        for (const [kind, model] of Object.entries(this.powerModels)) { item(model, game.power?.kind === kind ? game.power : null); model.children[0].rotation.y = t; }
        this.portalModels.forEach(m => { m.children[1].rotation.z = t * .7; });
        this.exit.visible = !game.tutorialPractice; this.exitBeam.visible = game.exitOpen();
        this.exit.children[0].material.color.set(this.exitBeam.visible ? GREEN : '#345251').multiplyScalar(this.exitBeam.visible ? 2 : 1);
        this.exit.children[1].material.color.copy(this.exit.children[0].material.color);
        this.gateModels.forEach((models, i) => models.forEach(m => {
            const gate = game.gates[i]; m.visible = gate.active || gate.warning;
            for (const child of m.children) child.material.color.set(gate.active ? '#ff4868' : '#ffb446').multiplyScalar(gate.active ? 2 : 1);
            m.children[0].scale.y = gate.active ? .11 : .04;
        }));
        this.layerGrid.position.y = game.snake[0].y + .03; this.layerGrid.visible = game.snake[0].y > 0;
        this.shadow.position.set(this.head.position.x, .035, this.head.position.z);
        const target = game.exitOpen() ? game.level.exit : game.food;
        this.targetBeam.visible = !!target;
        if (target) { const p = this.point(target); this.targetBeam.position.set(p.x, p.y / 2, p.z); this.targetBeam.scale.set(1, p.y, 1); this.targetBeam.material.color.set(this.exitBeam.visible ? GREEN : GOLD).multiplyScalar(1.5); }
        this.slowRing.visible = game.effects.slow > game.time; this.slowRing.position.y = 1 + Math.sin(t) * .2;
        this.slowRing.scale.setScalar(1 + Math.sin(t * 1.2) * .05);
        this.particles.forEach((p, i) => { p.p.toArray(this.particlePositions, i * 3); p.rgb.clone().multiplyScalar(Math.min(1, p.life * 2)).toArray(this.particleColors, i * 3); });
        this.particleGeo.setDrawRange(0, this.particles.length); this.particleGeo.attributes.position.needsUpdate = this.particleGeo.attributes.color.needsUpdate = true;
        const theme = document.documentElement.dataset.theme;
        if (this.lastTheme !== theme || this.lastReduced !== this.reduced.matches) { this.lastTheme = theme; this.lastReduced = this.reduced.matches; this.renderer.toneMappingExposure = theme === 'light' ? 1.23 : 1.12; this.bloom.strength = this.reduced.matches ? .32 : this.low ? .45 : .63; }
        this.renderer.info.reset();
        const before = performance.now(); this.composer.render(); const duration = performance.now() - before;
        this.slowFrames = duration > 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
        if (this.slowFrames > 80) this.setLow();
    }
}
