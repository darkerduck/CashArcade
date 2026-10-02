// Pure event mapping: simultaneous food/exit still plays the food once, first.
export function playEvents(events, sound, music) {
    for (const e of events) {
        if (e.type === 'eat') { sound.play(e.kind); music.duck(); }
        if (e.type === 'power') { sound.play(`snake${e.kind[0].toUpperCase()}${e.kind.slice(1)}`); music.duck(); }
        if (e.type === 'portal') sound.play('snakePortal');
        if (e.type === 'shield-hit') sound.play('snakeShieldHit');
        if (e.type === 'gate-warning') sound.play('snakeWarning');
        if (e.type === 'exit-open') sound.play('level', .28);
        if (e.type === 'level-clear') { sound.play('level', .28); music.pause(); }
        if (e.type === 'won') { sound.play('win', .28); music.pause(); }
        if (e.type === 'lose') { sound.play(e.reason === 'bomb' ? 'bomb' : 'lose'); music.pause(); }
    }
}
