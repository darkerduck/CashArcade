(() => {
    'use strict';
    const { Game, fresh, LEVELS } = NeonAssault;
    let theme = 'dark'; document.documentElement.dataset.theme = theme;
    const scenes = LEVELS.map((config, i) => {
        const section = document.createElement('section'), title = document.createElement('h2'), canvas = document.createElement('canvas'), text = document.createElement('p');
        title.textContent = `${String(i + 1).padStart(2, '0')} / ${config.name}`; text.textContent = config.boss;
        section.append(title, canvas, text); document.getElementById('scenes').append(section);
        return { canvas, renderer: new NeonAssaultRenderer(canvas), level: i + 1 };
    });
    function draw() {
        const phase = document.getElementById('scene').value;
        for (const { renderer: r, level } of scenes) {
            r.reset(); r.time = 6;
            const g = new Game({ ...fresh(), level, power: 3, wings: 2, weapon: level === 2 ? 'laser' : 'spread' });
            g.time = 32; g.player.x = 260; g.player.y = 640; g.player.invulnerable = 0;
            for (let i = 0; i < 5; i++) g.spawn(i === 3 ? 'gunship' : i % 2 ? 'fighter' : 'scout', 70 + i * 100, 320 + i % 3 * 65);
            g.drop('wing', 150, 570); g.drop('repair', 385, 500); g.fire();
            for (let i = 0; i < 12; i++) g.bullets.push({ x: 70 + i * 36, y: 470 + Math.sin(i * .6) * 90, r: 5 });
            if (phase !== 'flight') {
                g.spawnBoss(); g.boss.age = 8; g.boss.y = 160; g.boss.phase = phase === 'debris' ? 'rage' : phase;
                g.boss.rage = phase === 'rage';
                if (phase !== 'armor') { g.boss.nodes.forEach(n => n.hp = 0); g.boss.hp *= phase === 'core' ? .7 : .3; }
                if (phase === 'rage' && level >= 2) g.boss.sweep = { x: 410, age: 1.4, width: 48 };
                for (let i = 0; i < 19; i++) g.bullets.push({ x: 60 + i * 23, y: 260 + Math.sin(i * Math.PI / 18) * 180, r: 5 });
                if (phase === 'debris') { g.boss.dead = true; r.consume([{ type: 'bossDown', x: 270, y: 160 }]); r.update(.45); }
            }
            r.draw(g, theme);
        }
    }
    document.getElementById('scene').addEventListener('change', draw);
    document.getElementById('theme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; draw(); });
    document.getElementById('audio-check').addEventListener('click', async () => {
        const output = document.getElementById('audio-result'), button = document.getElementById('audio-check'); button.disabled = true; output.textContent = '量測中…';
        const lines = [];
        try {
            for (let level = 1; level <= 3; level++) for (const phase of [0, 'armor', 'core', 'rage']) {
                const p = NeonAssaultScore.profile(level, phase), step = 60 / p.bpm / 4, seconds = step * 128 + .5;
                const context = new OfflineAudioContext(1, Math.ceil(22050 * seconds), 22050), synth = CashArcadeMusic.synth(context);
                synth.volume(1); for (let i = 0; i < 128; i++) synth.step(p, i, i * step, NeonAssaultScore);
                const rendered = await context.startRendering(), samples = rendered.getChannelData(0);
                let peak = 0, sum = 0, finite = true;
                for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; finite &&= Number.isFinite(sample); }
                const rms = Math.sqrt(sum / samples.length), passed = finite && peak < .99 && rms > .003;
                lines.push(`${passed ? 'PASS' : 'FAIL'} 關卡 ${level} / ${phase || '航路'} · ${p.bpm} BPM · peak ${peak.toFixed(3)} · RMS ${rms.toFixed(3)}`);
                output.textContent = lines.join('\n');
            }
        } catch (error) { output.textContent += '\n量測失敗：' + error.message; }
        button.disabled = false;
    });
    draw();
})();
