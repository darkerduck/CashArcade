(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const { Game, W, H } = Lightbubble;
    const fixtures = [];
    let theme = 'dark', reduced = false, cascade = false;
    for (const [level, angle, tool] of [[4, -28, null], [12, -33, 'drill'], [18, -28, 'pulse']]) {
        const section = document.createElement('section'), title = document.createElement('h2'), canvas = document.createElement('canvas');
        const data = LightbubbleLevels.levels[level - 1];
        title.textContent = LightbubbleLevels.sectors[data.sector] + ' · ' + data.name;
        canvas.width = W; canvas.height = H;
        canvas.setAttribute('aria-label', title.textContent + '展示');
        section.append(title, canvas); $('panels').append(section);
        fixtures.push({ level, angle: angle * Math.PI / 180, tool, renderer: new LightbubbleRenderer.Renderer(canvas) });
    }
    function draw() {
        for (const { level, angle, tool, renderer } of fixtures) {
            const game = new Game(level);
            renderer.reset();
            renderer.reduced = reduced;
            if (tool) game.select(tool);
            if (cascade) {
                game.shoot(angle); game.settle();
                renderer.consume(game.drain()); renderer.update(.21);
            }
            renderer.draw(game, { theme, angle, guide: !cascade, dragging: !cascade });
        }
    }
    $('cascade').addEventListener('click', () => {
        cascade = !cascade;
        $('cascade').textContent = cascade ? '切換成瞄準示範' : '切換成消除示範';
        draw();
    });
    $('theme').addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme;
        draw();
    });
    $('motion').addEventListener('click', () => {
        reduced = !reduced;
        $('motion').setAttribute('aria-pressed', String(reduced));
        draw();
    });
    function frame(width, height) {
        let view = $('game-frame');
        if (!view) {
            view = document.createElement('iframe');
            view.id = 'game-frame';
            view.src = '../bubbles/';
            view.title = '光泡連鎖響應式版面';
            $('layout-check').append(view);
        }
        view.width = width; view.height = height;
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
    async function measure(level, phase, mixed) {
        const score = LightbubbleScore, profile = score.profile(level, phase);
        const interval = 60 / profile.bpm / 4, rate = 22050;
        const context = new OfflineAudioContext(1, Math.ceil((128 * interval + .6) * rate), rate);
        const Native = window.AudioContext;
        let audio;
        try {
            window.AudioContext = function () { return context; };
            audio = CashArcadeAudio.create({ storageKey: 'casharcade-bubbles-audio-qa', toggleButton: document.createElement('button'),
                musicMix: true, outputLevel: .58 });
            audio.musicOutput();
        } finally { window.AudioContext = Native; }
        const synth = CashArcadeMusic.synth(context, audio.musicOutput().destination);
        synth.volume(1);
        for (let i = 0; i < 128; i++) synth.step(profile, i, .05 + i * interval, score);
        if (mixed) for (const name of ['Launch', 'Bounce', 'Attach', 'Pop', 'Drop', 'Pulse', 'Drill', 'Crack', 'Descend', 'Win', 'Lost']) {
            audio.play('bubble' + name, .32);
        }
        const buffer = await context.startRendering();
        const samples = buffer.getChannelData(0);
        let peak = 0, sum = 0;
        for (const s of samples) { peak = Math.max(peak, Math.abs(s)); sum += s * s; }
        const rms = Math.sqrt(sum / samples.length), pass = Number.isFinite(rms) && rms > .003 && peak < .99;
        const label = (pass ? 'PASS ' : 'FAIL ') + profile.label + (mixed ? ' + 11 種音效' : '') +
            ' | peak ' + peak.toFixed(4) + ' | RMS ' + rms.toFixed(4);
        const card = document.createElement('section'), caption = document.createElement('p'), player = document.createElement('audio');
        caption.textContent = label;
        player.controls = true; player.preload = 'none'; player.setAttribute('aria-label', profile.label);
        player.src = URL.createObjectURL(wav(buffer)); urls.push(player.src);
        card.append(caption, player); $('samples').append(card);
        return label;
    }
    $('measure').addEventListener('click', async () => {
        const control = $('measure'), lines = [];
        control.disabled = true;
        $('result').textContent = '量測中…';
        $('samples').replaceChildren();
        urls.splice(0).forEach(URL.revokeObjectURL);
        try {
            for (const [level, phase, mix] of [[1], [7], [13], [13, 'pressure'], [13, 'pressure', true]]) {
                lines.push(await measure(level, phase, mix));
                $('result').textContent = lines.join('\n');
            }
        } catch (error) { $('result').textContent += '\n無法量測：' + error.message; }
        finally { control.disabled = false; }
    });
})();
