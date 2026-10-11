// A real seed-1 run: only hold, clockwise rotate, horizontal move, hard drop,
// and ordinary engine ticks. No board, bag, score, collision or timing edits.
export const CASCADE_REPLAY = Object.freeze({seed:1,placements:Object.freeze([
    [false,0,3],[true,1,2],[false,1,1],[false,2,7],[false,0,3],[true,0,6],
    [false,1,3],[false,0,1],[false,0,6],[false,1,6],[false,1,5],[false,3,4],
    [false,3,5],[true,0,3],[false,0,3],[false,3,4],[false,0,5],[false,1,3],
    [false,1,7],[true,0,6],[false,0,5],[false,1,5],[false,0,1],[false,0,1]
].map(Object.freeze))});
export function replayCascade(Game) {
    const game = new Game(CASCADE_REPLAY.seed), clears = [];
    game.start();
    for (const [hold,rotations,x] of CASCADE_REPLAY.placements) {
        if (hold && !game.swap()) throw Error('Replay hold failed');
        for (let i = 0; i < rotations; i++) if (!game.rotate()) throw Error('Replay rotation failed');
        while (game.piece && game.piece.x !== x) if (!game.move(Math.sign(x - game.piece.x))) throw Error('Replay movement failed');
        if (!game.drop()) throw Error('Replay drop failed');
        let ticks = 0;
        do {
            for (const event of game.drain()) if (event.type === 'clear') clears.push(event);
            if (game.clearTime > 0) game.update(.05);
            if (++ticks > 40) throw Error('Cascade did not settle');
        } while (game.clearTime > 0);
        for (const event of game.drain()) if (event.type === 'clear') clears.push(event);
        if (game.state !== 'running') throw Error('Replay blocked the spawn');
    }
    return {game,clears};
}
