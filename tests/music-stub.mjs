export function musicStub(events = []) {
    return {
        CashArcadeScores: {snake:{},flappy:{},breakout:{}},
        CashArcadeMusic: {create: () => Object.fromEntries(['start','pause','resume','phase','duck','wake'].map(name => [name,(...args)=>events.push([name,...args])]))},
    };
}
