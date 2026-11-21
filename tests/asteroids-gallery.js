(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const fixtures = [], urls = [];
    let bosses = false, theme = 'dark', reduced = false;
    for (const sector of NeonAsteroidsData.sectors) {
        const card = document.createElement('section'), heading = document.createElement('h2'), canvas = document.createElement('canvas');
        canvas.width = canvas.height = 720;
        canvas.setAttribute('aria-label', sector + '驗收畫面');
        card.append(heading, canvas);
        $('scenes').append(card);
        fixtures.push({ heading, renderer: new NeonAsteroidsRenderer(canvas) });
    }
    function draw() {
        fixtures.forEach(({ heading, renderer }, i) => {
            const level = i * 3 + (bosses ? 3 : 2);
            const game = new NeonAsteroids.Game({ ...NeonAsteroidsStorage.fresh(9312), level,
                shield: true, weapon: i ? 'laser' : 'spread', spread: 2, laser: 3, escorts: 2 });
            Object.assign(game.player, { x: i === 2 ? 13 : 330, y: 462, vx: 140, vy: 110, angle: -1.1, thrust: true });
            if (bosses) {
                game.deployBoss();
                game.boss.timer = 0.44;
                game.updateBoss(0.10);
                if (i === 2) {
                    game.boss.parts.forEach(part => { part.dead = true; });
                    game.boss.core.hp = 158;
                    game.updateBoss(0.1);
                }
            } else {
                game.addEnemy('large', 165, 215);
                game.addEnemy('medium', 142, 352);
                game.addEnemy(i === 2 ? 'frigate' : 'gunship', 450, 278);
                game.addEnemy('fighter', 530, 320);
                game.queue('fighter');
            }
            game.loot.push({ x: 445, y: 501, type: 'shield', ttl: 8 });
            game.fire();
            for (const bullet of game.projectiles) {
                bullet.x = NeonAsteroids.wrap(bullet.x + bullet.vx * .22);
                bullet.y = NeonAsteroids.wrap(bullet.y + bullet.vy * .22);
            }
            renderer.reset();
            renderer.reduced = reduced;
            renderer.consume([{ type: 'shatter', x: 235, y: 254, radius: 30 }]);
            renderer.update(.18);
            renderer.draw(game, theme);
            heading.textContent = game.data.name + ' · ' + NeonAsteroidsData.sectors[i];
        });
    }
    $('scene').addEventListener('click', () => { bosses = !bosses; $('scene').textContent = bosses ? '切換至星域戰鬥' : '切換至三場頭目'; draw(); });
    $('theme').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; draw(); });
    $('motion').addEventListener('click', () => { reduced = !reduced; $('motion').setAttribute('aria-pressed', String(reduced)); draw(); });
    function preview(width, height) {
        let frame = $('layout-frame');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'layout-frame';
            frame.title = '碎星獵手版面檢查';
            frame.src = '../asteroids/';
            frame.allowFullscreen = true;
            $('layout-preview').append(frame);
        }
        frame.width = width;
        frame.height = height;
    }
    $('portrait').addEventListener('click', () => preview(390, 844));
    $('landscape').addEventListener('click', () => preview(844, 390));
    draw();

    function wav(buffer) {
        const samples = buffer.getChannelData(0), data = new ArrayBuffer(44 + samples.length * 2), header = new DataView(data);
        const str = (offset, value) => [...value].forEach((char, i) => header.setUint8(offset + i, char.charCodeAt(0)));
        str(0, 'RIFF'); header.setUint32(4, data.byteLength - 8, true); str(8, 'WAVE');
        str(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true);
        header.setUint16(22, 1, true); header.setUint32(24, buffer.sampleRate, true); header.setUint32(28, buffer.sampleRate * 2, true);
        header.setUint16(32, 2, true); header.setUint16(34, 16, true); str(36, 'data'); header.setUint32(40, samples.length * 2, true);
        samples.forEach((value, i) => header.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 32767, true));
        return new Blob([data], { type: 'audio/wav' });
    }
    async function measure(level, phase, mixed) {
        const score = StarshardScore, profile = score.profile(level, phase);
        const seconds = 128 * 60 / profile.bpm / 4 + 0.8, rate = 22050;
        const context = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
        const Native = window.AudioContext;
        let audio;
        try {
            window.AudioContext = function () { return context; };
            audio = CashArcadeAudio.create({ storageKey: 'casharcade-starshard-audio-qa', toggleButton: document.createElement('button'),
                musicMix: true, outputLevel: .58 });
            audio.musicOutput();
        } finally { window.AudioContext = Native; }
        const instrument = CashArcadeMusic.synth(context, audio.musicOutput().destination);
        instrument.volume(1);
        for (let i = 0; i < 128; i++) instrument.step(profile, i, .05 + i * 60 / profile.bpm / 4, score);
        if (mixed) {
            StarshardSound.createThrust(audio.musicOutput).update(true);
            const effects = new Set([...Object.values(StarshardSound.effects), ...Object.values(StarshardSound.weapons)]);
            for (const effect of effects) audio.play(effect, .3);
        }
        const buffer = await context.startRendering();
        let peak = 0, sum = 0;
        const samples = buffer.getChannelData(0);
        for (const value of samples) { peak = Math.max(peak, Math.abs(value)); sum += value * value; }
        const rms = Math.sqrt(sum / samples.length);
        const pass = Number.isFinite(rms) && rms > .003 && peak < .99;
        const label = (pass ? 'PASS ' : 'FAIL ') + profile.name + (phase ? ' · 過載' : '') +
            (mixed ? ' + 推進與全部音效' : '') + ' | peak ' + peak.toFixed(4) + ' | RMS ' + rms.toFixed(4);
        const card = document.createElement('section'), text = document.createElement('p'), player = document.createElement('audio');
        text.textContent = label;
        player.controls = true;
        player.setAttribute('aria-label', profile.name);
        player.src = URL.createObjectURL(wav(buffer));
        urls.push(player.src);
        card.append(text, player);
        $('tracks').append(card);
        return label;
    }
    $('audio-check').addEventListener('click', async () => {
        const button = $('audio-check'), results = [];
        button.disabled = true;
        $('audio-result').textContent = '量測中…';
        $('tracks').replaceChildren();
        urls.splice(0).forEach(URL.revokeObjectURL);
        try {
            for (const [level, phase, mixed] of [[1], [3], [4], [6], [7], [9], [9, 'overload'], [9, 'overload', true]]) {
                results.push(await measure(level, phase, mixed));
                $('audio-result').textContent = results.join('\n');
            }
        } catch (error) { $('audio-result').textContent += '\n無法量測：' + error.message; }
        finally { button.disabled = false; }
    });
})();
