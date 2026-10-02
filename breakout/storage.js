(() => {
    'use strict';
    const api = typeof module !== 'undefined' && module.exports ? require('./engine.js') : window.NeonBreakout;
    const KEY = 'casharcade.breakout.round.v2', OLD_KEY = 'casharcade.breakout.round.v1', BACKUP_KEY = 'casharcade.breakout.paid-backup.v2';
    const STATES = ['ready','running','paused','life-lost','level-clear','over','won'];
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    const list = (v, max) => Array.isArray(v) && v.length <= max;
    function valid(data) {
        if (!data || data.version !== 2 || !STATES.includes(data.state) || !Number.isInteger(data.levelIndex) || data.levelIndex < 0 || data.levelIndex >= 30 || !Number.isInteger(data.lives) || data.lives < 0 || data.lives > 5 || !finite(data.score) || data.score < 0 || !finite(data.time) || data.time < 0 || !Number.isInteger(data.wave) || data.wave < 0 || data.wave > 2 || !Number.isInteger(data.bossPhase) || data.bossPhase < 0 || data.bossPhase > 2) return false;
        if (!data.paddle || !['x','w','vx','chargeAt','releaseUntil','releasePower','cooldownUntil'].every(k => finite(data.paddle[k]))) return false;
        if (!list(data.balls, 24) || !data.balls.every(b => ['id','x','y','vx','vy','r','strongUntil','portalUntil'].every(k => finite(b[k])))) return false;
        if (!list(data.bricks, 300) || !data.bricks.every(b => ['id','x','y','bx','by','w','h','hp','maxHp'].every(k => finite(b[k])) && Object.hasOwn(api.HP, b.type))) return false;
        if (!list(data.items, 300) || !data.items.every(i => api.POWERS[i.name] && finite(i.x) && finite(i.y)) || !list(data.shots, 100)) return false;
        if (!list(data.gates, 20) || !data.gates.every(g=>['x','y','bx','by','w','h'].every(k=>finite(g[k]))&&typeof g.open==='boolean')) return false;
        if (!list(data.portals, 12) || !data.portals.every(p=>['x','y','tx','ty','r','angle'].every(k=>finite(p[k])))) return false;
        if (!data.effects || !Object.entries(data.effects).every(([k,v]) => api.POWERS[k] && finite(v))) return false;
        return ['seed','id','shield','nextRain','nextLaser','combo','lastHit'].every(k => finite(data[k]));
    }
    function migrate(old) {
        if (!old || old.version !== 1 || !STATES.includes(old.gameState) || !Number.isInteger(old.levelIndex) || old.levelIndex < 0 || old.levelIndex > 2 || !finite(old.score) || !Number.isInteger(old.lives) || old.lives < 0 || old.lives > 3 || !list(old.bricks, 150)) throw new Error('Invalid legacy checkpoint');
        const g = new api.Game({ levelIndex: old.levelIndex, score: old.score, lives: old.lives });
        // Keep the exact old board/HP until this stage clears, then use the next authored stage.
        g.bricks = old.bricks.map((b, i) => {
            if (!['x','y','width','height','hp','maxHp'].every(k => finite(b[k])) || b.hp < 0 || b.hp > b.maxHp) throw new Error('Invalid legacy brick');
            return { id: i + 1, x: b.x, y: b.y, bx: b.x, by: b.y, w: b.width, h: b.height, hp: b.hp * 2, maxHp: b.maxHp * 2, type: b.maxHp > 1 ? 'armor' : 'normal', active: false, emitted: 0, nextEmission: 0 };
        });
        const ball = old.ball;
        if (ball && ['x','y','vx','vy'].every(k => finite(ball[k]))) { g.balls = []; const b = g.spawnBall(ball.x, ball.y, ball.vx, ball.vy, !!ball.attached); b.r = 8; }
        g.state = old.gameState === 'running' ? 'paused' : old.gameState;
        if (old.paddle && finite(old.paddle.x)) g.movePaddle(old.paddle.x + 58);
        return { version: 2, pending: false, paidReady: old.paidReady === true, played: true, game: g.snapshot(), migrated: true };
    }
    function create(local, session) {
        function write(envelope) {
            const value = JSON.stringify(envelope);
            local.setItem(KEY, value);
            if (local.getItem(KEY) !== value) throw new Error('Checkpoint was not retained');
        }
        function load() {
            try {
                const backup = session.getItem(BACKUP_KEY);
                if (backup) { const e = JSON.parse(backup); if (!e.paidReady || !valid(e.game)) throw new Error('Invalid paid checkpoint'); write(e); session.removeItem(BACKUP_KEY); return { envelope: e }; }
                const value = local.getItem(KEY);
                if (value) { const e = JSON.parse(value); if (e.version !== 2 || typeof e.pending !== 'boolean' || typeof e.paidReady !== 'boolean' || !valid(e.game)) throw new Error('Invalid checkpoint'); return { envelope: e }; }
                const legacy = session.getItem(OLD_KEY);
                if (legacy) { const e = migrate(JSON.parse(legacy)); write(e); return { envelope: e }; }
                return { envelope: null };
            } catch { return { blocked: true, envelope: null }; }
        }
        function paidBackup(envelope) { session.setItem(BACKUP_KEY, JSON.stringify(envelope)); }
        return { load, write, paidBackup, clearPaidBackup() { session.removeItem(BACKUP_KEY); } };
    }
    Object.assign(api, { Save: { create, valid, migrate, KEY, OLD_KEY, BACKUP_KEY } });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
