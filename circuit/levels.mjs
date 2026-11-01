// Ten original, fixed circuit layouts. Coordinates are tile centers, never pixels.
// # wall · o energy · * optional data shard · + cloak charge · T route switch
// A/B gates alternate with the global circuit phase · ! pulse-laser shortcut.
const layouts = [
  {
    name: '初次入侵', zone: 'BOOT SECTOR', accent: '#43e6ff', par: 55,
    tip: '先收齊青色能量，再到右上出口。方向會持續前進，可提早輸入下一個轉彎。',
    rows: [
      '#################',
      '#S..o...#...o..E#',
      '#.###.#.#.#.###.#',
      '#.....#...#.....#',
      '#.###.#####.###.#',
      '#...#...o...#...#',
      '###.#.#####.#.###',
      '#...#...#...#...#',
      '#.#####.#.#####.#',
      '#...o...+...o...#',
      '#.###.#####.###.#',
      '#.......*.......#',
      '#################',
    ],
    patrols: [{from:[7,3],to:[9,3],every:4}],
  },
  {
    name: '雙向匯流', zone: 'CROSS LINK', accent: '#b496ff', par: 65,
    tip: '踩上圓形開關切換 A / B 通道。關閉的閘門只擋入口，不會傷害你。',
    rows: [
      '#################',
      '#S..o...#...o..E#',
      '#.###.#.#.#.###.#',
      '#...#.#.A.#.#...#',
      '###.#.#.#.#.#.###',
      '#o..#...T...#..o#',
      '#.#####.#.#####.#',
      '#...#...B...#...#',
      '#.#.#.#####.#.#.#',
      '#.#...+...*...#.#',
      '#.###.#####.###.#',
      '#...o...T...o...#',
      '#################',
    ],
    patrols: [{from:[5,5],to:[11,5],every:4}],
  },
  {
    name: '靜默頻段', zone: 'GHOST SIGNAL', accent: '#9cffbf', par: 70,
    tip: '空白鍵或「隱形」消耗一次充能，4.5 秒內可穿過巡邏機。雷射仍然危險。',
    rows: [
      '#################',
      '#S.+..o...o...E.#',
      '#.###.###.###.#.#',
      '#...#...#...#.#.#',
      '#.#.###.#.###.#.#',
      '#o#.....o.....#o#',
      '#.#.###.#.###.#.#',
      '#...#...#...#...#',
      '###.#.#####.#.###',
      '#o..#...+...#..o#',
      '#.#.###.#.###.#.#',
      '#...*...#...*...#',
      '#################',
    ],
    patrols: [{from:[5,5],to:[11,5],every:3},{from:[1,1],to:[15,1],every:4,offset:8}],
  },
  {
    name: '脈衝捷徑', zone: 'PULSE ALLEY', accent: '#ffbc66', par: 75,
    tip: '橘色雷射每 3.6 秒循環，實線亮起時有傷害。等熄滅再走捷徑，或走外圈。',
    rows: [
      '#################',
      '#S..o.......o..E#',
      '#.###.#####.###.#',
      '#...#...#...#...#',
      '#.#.###.#.###.#.#',
      '#o#.....!.....#o#',
      '#.#.###.#.###.#.#',
      '#...#...*...#...#',
      '#.#####.!.#####.#',
      '#...o...+...o...#',
      '#.###.#####.###.#',
      '#.......*.......#',
      '#################',
    ],
    patrols: [{from:[1,11],to:[15,11],every:3},{from:[5,5],to:[11,5],every:4}],
  },
  {
    name: '鏡像交換', zone: 'MIRROR BUS', accent: '#ee96ff', par: 85,
    tip: '兩組交錯通道共用同一個相位。用開關重新排列路線，再帶能量回出口。',
    rows: [
      '#################',
      '#S..o.T.#.T.o..E#',
      '#.###.#.#.#.###.#',
      '#...#...A...#...#',
      '#.#.###.#.###.#.#',
      '#o#...o.#.o...#o#',
      '#.#.#.#####.#.#.#',
      '#...#...B...#...#',
      '#.###.#.#.#.###.#',
      '#...T.+.#.+.T...#',
      '#.#.###.#.###.#.#',
      '#...*...A...*...#',
      '#################',
    ],
    patrols: [{from:[5,3],to:[11,3],every:3},{from:[1,9],to:[7,9],every:4},{from:[9,9],to:[15,9],every:4}],
  },
  {
    name: '巡邏網格', zone: 'WATCH NETWORK', accent: '#ff7897', par: 85,
    tip: '巡邏機沿固定軌道往返，箭頭顯示方向。停步觀察，再把下一個轉彎排好。',
    rows: [
      '#################',
      '#S..o...+...o..E#',
      '#.#.#.#.#.#.#.#.#',
      '#...............#',
      '#.#.###.#.###.#.#',
      '#o#...o.T.o...#o#',
      '#.#.#.#####.#.#.#',
      '#...#...A...#...#',
      '#.#.#.#####.#.#.#',
      '#...o...+...o...#',
      '#.#.###.#.###.#.#',
      '#*......!......*#',
      '#################',
    ],
    patrols: [{from:[1,3],to:[15,3],every:3},{from:[1,9],to:[15,9],every:4,offset:7},{from:[1,11],to:[15,11],every:3,offset:12}],
  },
  {
    name: '斷電迴廊', zone: 'BLACKOUT LOOP', accent: '#70d3ff', par: 95,
    tip: '雷射與 A / B 閘門交錯。隱形可以躲巡邏，不能讓關閉的路徑變成通道。',
    rows: [
      '#################',
      '#S..o...#...o..E#',
      '#.###.#.#.#.###.#',
      '#...#...A...#...#',
      '#.#.###.#.###.#.#',
      '#o#.+.T.!.....#o#',
      '#.#.#.#####.#.#.#',
      '#...#...B...#...#',
      '#.###.#.#.#.###.#',
      '#...o...T...o...#',
      '#.#.###.#.###.#.#',
      '#...*...!...+...#',
      '#################',
    ],
    patrols: [{from:[5,5],to:[11,5],every:3},{from:[1,9],to:[15,9],every:4,offset:10},{from:[1,11],to:[15,11],every:4,offset:5}],
  },
  {
    name: '封包迷航', zone: 'PACKET MAZE', accent: '#ac9cff', par: 105,
    tip: '狹長迴路沒有回頭的餘地？任何時候都能反向，隱形充能留給迎面巡邏。',
    rows: [
      '#################',
      '#S..o...#...o..E#',
      '###.###.#.###.###',
      '#...#...A...#...#',
      '#.###.#.#.#.###.#',
      '#o..#.+.T.+.#..o#',
      '#.#.###.#.###.#.#',
      '#.#.....B.....#.#',
      '#.###.#.#.#.###.#',
      '#...o.#...#.o...#',
      '#.#####.!.#####.#',
      '#*......+......*#',
      '#################',
    ],
    patrols: [{from:[3,7],to:[13,7],every:3},{from:[1,11],to:[15,11],every:3,offset:7},{from:[5,3],to:[11,3],every:3,offset:4}],
  },
  {
    name: '核心防線', zone: 'CORE FIREWALL', accent: '#ffc376', par: 110,
    tip: '金色資料碎片是可選挑戰。先規劃能量與出口，再決定要不要冒險拿滿三星。',
    rows: [
      '#################',
      '#S..o.T.A.T.o..E#',
      '#.#.###.#.###.#.#',
      '#.#...o.#.o...#.#',
      '#.###.#.#.#.###.#',
      '#o..#...B...#..o#',
      '#.#.#.#####.#.#.#',
      '#.#.....!.....#.#',
      '#.#####.#.#####.#',
      '#...o.+.T.+.o...#',
      '#.#.###.#.###.#.#',
      '#*......!......*#',
      '#################',
    ],
    patrols: [{from:[3,7],to:[13,7],every:3},{from:[1,9],to:[15,9],every:3,offset:8},{from:[1,11],to:[15,11],every:3,offset:5},{from:[5,5],to:[11,5],every:4}],
  },
  {
    name: '零時逃逸', zone: 'ZERO HOUR', accent: '#43e6ff', par: 125,
    tip: '最後一道防線：相位、隱形、脈衝都由你掌握。帶走全部能量，讓整座電路亮起。',
    rows: [
      '#################',
      '#S..o.T.#.T.o..E#',
      '#.#.#.#.#.#.#.#.#',
      '#...#...A...#...#',
      '#.###.#.#.#.###.#',
      '#o..#o+.!.+o#..o#',
      '#.#.###.#.###.#.#',
      '#.#.....B.....#.#',
      '#.###.#.#.#.###.#',
      '#...o.T.!...o...#',
      '#.#.###.#.###.#.#',
      '#*....+.A.+....*#',
      '#################',
    ],
    patrols: [{from:[3,7],to:[13,7],every:3},{from:[1,9],to:[15,9],every:3,offset:10},{from:[1,11],to:[15,11],every:3,offset:6},{from:[5,3],to:[11,3],every:3,offset:3}],
  },
];

const freezePoint = ([x,y]) => Object.freeze({x,y});
export function buildLevel(definition, index=0) {
  const rows = definition.rows.slice(), width=rows[0].length, height=rows.length;
  if (rows.some(row=>row.length!==width)) throw new Error(`Uneven circuit ${index+1}`);
  let start, exit; const nodes=[], shards=[], cloaks=[], switches=[], gates=[], lasers=[];
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const p=Object.freeze({x,y}), tile=rows[y][x];
    if(tile==='S') start=p; if(tile==='E') exit=p;
    if(tile==='o') nodes.push(p); if(tile==='*') shards.push(p); if(tile==='+') cloaks.push(p);
    if(tile==='T') switches.push(p); if(tile==='A'||tile==='B') gates.push(Object.freeze({...p,phase:tile==='A'?0:1}));
    if(tile==='!') lasers.push(Object.freeze({...p,offset:lasers.length*8}));
  }
  if(!start||!exit)throw new Error(`Missing start/exit in circuit ${index+1}`);
  const patrols=(definition.patrols||[]).map((p,i)=>{
    const [ax,ay]=p.from,[bx,by]=p.to;
    if(ax!==bx&&ay!==by)throw new Error('Patrol must use an orthogonal corridor');
    const n=Math.abs(bx-ax)+Math.abs(by-ay),path=[];
    for(let j=0;j<=n;j++)path.push(freezePoint([ax+Math.sign(bx-ax)*j,ay+Math.sign(by-ay)*j]));
    for(const pt of path)if(!rows[pt.y]||rows[pt.y][pt.x]==='#')throw new Error(`Patrol crosses a wall in circuit ${index+1}`);
    return Object.freeze({id:i,path:Object.freeze(path),every:p.every||4,offset:Math.min(p.offset||0,n)});
  });
  return Object.freeze({id:index,name:definition.name||'測試',zone:definition.zone||'TEST',accent:definition.accent||'#43e6ff',par:definition.par||80,
    tip:definition.tip||'',rows:Object.freeze(rows),width,height,start,exit,nodes:Object.freeze(nodes),shards:Object.freeze(shards),cloaks:Object.freeze(cloaks),switches:Object.freeze(switches),gates:Object.freeze(gates),lasers:Object.freeze(lasers),patrols:Object.freeze(patrols)});
}
export const LEVELS=Object.freeze(layouts.map(buildLevel));
