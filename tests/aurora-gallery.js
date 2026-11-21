(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const fixtures = [];
    let setting = 0, theme = 'dark', reduced = false, clockStart, request = null;
    for (const [level, entry] of [[1, false], [5, false], [9, true]]) {
        const game = new AuroraSprint.Game(level), group = document.createElement('section');
        const title = document.createElement('h2'), canvas = document.createElement('canvas');
        const begin = entry ? game.level.tunnels[1][0] + 10 : level === 5 ? 779 : 840;
        title.textContent = game.level.name + ' · ' + AuroraRoutes.sectors[game.level.sector].name;
        canvas.width = AuroraRenderer.W; canvas.height = AuroraRenderer.H; canvas.setAttribute('aria-label', title.textContent);
        group.append(title, canvas);
        $('shots').append(group);
        fixtures.push({ game, begin, renderer: new AuroraRenderer.Renderer(canvas) });
    }
    function draw(now = 0) {
        for (const { game, begin, renderer } of fixtures) {
            const offset = (now * setting) % 118;
            const z = begin + offset;
            Object.assign(game, { distance: z, speed: setting, time: now + 4, x: -.53,
                inTunnel: AuroraRoutes.tunnelAt(game.level, z), boosting: game.level.id === 9 && setting !== 25 });
            game.objects = [
                { type: 'car', x: 4.2, z: begin + 37 + offset * .64, color: 1 },
                { type: game.level.id === 1 ? 'car' : 'truck', x: -4.2, z: begin + 58 + offset * .65, color: 3 },
                { type: 'barrier', x: -4.2, z: begin + 114 + offset * .58 },
                { type: 'cell', x: 0, z: begin + 52 + offset * .52 },
                { type: 'car', x: 0, z: begin + 108 + offset * .71, color: 2, signal: 1 }
            ];
            renderer.draw(game, { theme, reduced });
        }
    }
    function animate(now) {
        clockStart ??= now;
        draw((now - clockStart) / 1000);
        request = requestAnimationFrame(animate);
    }
    $('speed').addEventListener('click', () => {
        setting = setting === 0 ? 25 : setting === 25 ? 68 : 0;
        $('speed').textContent = '光流：' + (setting ? Math.round(setting * 3.6) + ' km/h' : '靜止');
        if (request !== null) cancelAnimationFrame(request);
        request = null; clockStart = undefined;
        if (setting) request = requestAnimationFrame(animate);
        else draw();
    });
    $('theme').addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme; if (!setting) draw();
    });
    $('motion').addEventListener('click', () => {
        reduced = !reduced; $('motion').setAttribute('aria-pressed', String(reduced)); if (!setting) draw();
    });
    function frame(width, height) {
        let node = $('layout-frame');
        if (!node) {
            node = document.createElement('iframe'); node.id = 'layout-frame'; node.src = '../aurora/';
            node.title = '極光疾馳版面驗收'; node.allowFullscreen = true;
            $('layout-check').append(node);
        }
        node.width = width; node.height = height;
    }
    $('portrait').addEventListener('click', () => frame(390, 844));
    $('landscape').addEventListener('click', () => frame(844, 390));
    draw();

    function wav(buffer) {
        const samples = buffer.getChannelData(0), data = new ArrayBuffer(44 + samples.length * 2), header = new DataView(data);
        const word = (offset, value) => [...value].forEach((c, i) => header.setUint8(offset + i, c.charCodeAt(0)));
        word(0, 'RIFF'); header.setUint32(4, data.byteLength - 8, true); word(8, 'WAVE');
        word(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true);
        header.setUint16(22, 1, true); header.setUint32(24, buffer.sampleRate, true); header.setUint32(28, buffer.sampleRate * 2, true);
        header.setUint16(32, 2, true); header.setUint16(34, 16, true); word(36, 'data'); header.setUint32(40, samples.length * 2, true);
        samples.forEach((s, i) => header.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
        return new Blob([data], { type: 'audio/wav' });
    }
    const urls = [];
    async function measure(level, phase, mix) {
        const profile = AuroraScore.profile(level, phase), interval = 60 / profile.bpm / 4, hz = 22050;
        const context = new OfflineAudioContext(1, Math.ceil((128 * interval + .65) * hz), hz);
        const Native = window.AudioContext;
        let audio;
        try {
            window.AudioContext = function () { return context; };
            audio = CashArcadeAudio.create({ storageKey: 'casharcade-aurora-audio-qa',
                toggleButton: document.createElement('button'), outputLevel: .57, musicMix: true });
            audio.musicOutput();
        } finally { window.AudioContext = Native; }
        const synth = CashArcadeMusic.synth(context, audio.musicOutput().destination);
        synth.volume(1);
        for (let i = 0; i < 128; i++) synth.step(profile, i, .06 + i * interval, AuroraScore);
        if (mix) {
            const road = AuroraSound.createRoadSound(audio.musicOutput);
            road.sync({ speed: 68, boosting: true, inTunnel: false });
            for (const effect of Object.values(AuroraSound.effects)) audio.play(effect, .34);
        }
        const buffer = await context.startRendering(), samples = buffer.getChannelData(0);
        let peak = 0, sum = 0;
        for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
        const rms = Math.sqrt(sum / samples.length), ok = Number.isFinite(rms) && rms > .003 && peak < .99;
        const caption = (ok ? 'PASS ' : 'FAIL ') + profile.label + (mix ? ' + 引擎、雨聲與九種音效' : '') +
            ' | peak ' + peak.toFixed(4) + ' | RMS ' + rms.toFixed(4);
        const card = document.createElement('section'), label = document.createElement('p'), player = document.createElement('audio');
        label.textContent = caption; player.controls = true; player.preload = 'none';
        player.setAttribute('aria-label', profile.label);
        player.src = URL.createObjectURL(wav(buffer)); urls.push(player.src);
        card.append(label, player); $('samples').append(card);
        return caption;
    }
    $('audio').addEventListener('click', async () => {
        $('audio').disabled = true; $('result').textContent = '量測中…';
        $('samples').replaceChildren(); urls.splice(0).forEach(URL.revokeObjectURL);
        const output = [];
        try {
            for (const [level, phase, mix] of [[1], [4], [7], [7, 'final'], [7, 'final', true]]) {
                output.push(await measure(level, phase, mix)); $('result').textContent = output.join('\n');
            }
        } catch (error) { $('result').textContent += '\n無法量測：' + error.message; }
        finally { $('audio').disabled = false; }
    });
})();
