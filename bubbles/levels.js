(() => {
    'use strict';
    const colors = Object.freeze({
        C: { name: '青藍', bright: '#59efff', dim: '#075b9b', pattern: 'ring' },
        P: { name: '桃紅', bright: '#ff82c4', dim: '#88236a', pattern: 'diamond' },
        G: { name: '翠綠', bright: '#a0f98a', dim: '#22724c', pattern: 'triangle' },
        A: { name: '琥珀', bright: '#ffd477', dim: '#9e4c18', pattern: 'cross' },
        V: { name: '紫晶', bright: '#ba9cff', dim: '#55308c', pattern: 'lines' }
    });
    const tools = Object.freeze({
        rainbow: { name: '彩虹泡', glyph: '◎', help: '接上碰到的同色鄰群。' },
        pulse: { name: '脈衝泡', glyph: '✦', help: '炸開落點和周圍一圈。' },
        drill: { name: '穿透泡', glyph: '↑', help: '穿透最多三顆，最後爆開停點。' }
    });
    const sectors = Object.freeze(['霓虹溫室', '流光水道', '結晶核心']);
    const levels = [
        ['晨光培育槽', '同色三顆相連就能消除。先瞄準青藍泡泡。', 6, 'CP',
            ['...CC.PP...', '...CCPP...'], {}, 'clear'],
        ['雙葉分岔', '可以交換預備泡泡。試著切斷泡泡串的上端。', 6, 'CG',
            ['..CCC.GGG..', '..CC..GG..', '...GG.CC...'], {}, 'clear'],
        ['側牆折光', '沿側牆反彈，可以打到被下排泡泡遮住的側邊。', 5, 'PCG',
            ['CC..PPP..GG', 'CC..PP..GG', '....GGG....', '...CCC....'], {}, 'clear'],
        ['懸掛花苞', '消除上端同色泡泡，下方失去支撐的泡泡會一起落下。', 5, 'GACP',
            ['..GG...AA..', '..GG...AA.', '..CCC.PPP..', '.AAA..GGG.'], { rainbow: 1 }, 'clear'],
        ['彩虹接橋', '彩虹泡會根據落點旁的同色群決定顏色。', 5, 'PCAV',
            ['PP.CCC.AA..', 'PP.CC.AA..', 'CC..VV.PP..', '...VV.PP..', '....AA.....'], { rainbow: 2 }, 'clear'],
        ['溫室開花', '利用牆面與脈衝泡，讓兩側枝條整片落下。', 5, 'APCGV',
            ['AAA.PPP.GGG', 'AA..PP..GG', '.CC.VVV.CC.', '.CC.VV.CC.', '..GG...PP..', '..GG...PP.'], { rainbow: 1, pulse: 1 }, 'clear'],
        ['光靈初遇', '讓金色光靈下方和側邊的泡泡脫離上緣，它就能獲救。', 5, 'CAP',
            ['..CC...AA..', '..CC...AA.', '...L...L...', '..PPP.AAA.'], { pulse: 1 }, 'rescue'],
        ['雙流匯口', '可以先打斷一側，再從空隙瞄準另一側光靈。', 5, 'PAGC',
            ['PPP...AAA..', 'PP...AAA..', '.L...G.L...', '.CG..GG...', '..CC...PP..'], { rainbow: 1, pulse: 1 }, 'rescue'],
        ['水道轉彎', '反彈線的圓圈標示實際吸附點。', 5, 'VGCAP',
            ['GG..VVV..CC', 'GG..VV..CC', '.L...L...L.', '...CCC....', '...AAA.....', '..PPPP....'], { rainbow: 1, pulse: 1 }, 'rescue'],
        ['鱗光暗河', '兩翼都有光靈。試試從離目標更近的側牆反彈。', 4, 'GAPCV',
            ['GGG.AAA.PPP', 'GG..AA..PP', '.L...L...L.', '.VV.CC.VV.', '.CCA..AGG..', '...PPGG...'], { pulse: 2 }, 'rescue'],
        ['穿透閘口', '穿透泡可切開擋在光靈前面的三顆泡泡。', 4, 'CAVPG',
            ['..CCCAACC..', '..CVVVVC..', '.LL.VVV.LL.', '..PPGGPP..', '...AGGA....', '..CCPPCC..'], { drill: 1, rainbow: 1, pulse: 1 }, 'rescue'],
        ['潮汐修復站', '選擇先救哪一側。大量泡泡落下時，附近光靈也會獲救。', 4, 'PAGCV',
            ['PPPGGGVVVAA', 'PP.GG.VVAA', '.L.C..L..L.', '.CC..CC.PP', '..AA.VV.PP.', '..AG.CG...', '..GG..CC...'], { drill: 2, rainbow: 1, pulse: 1 }, 'rescue'],
        ['晶種隔間', '結晶要承受兩次鄰近消除或道具攻擊，也能切斷支撐讓它落下。', 5, 'CPAVG',
            ['..CCC.PPP..', '..CC..PP..', '...X...X...', '..AAA.VVV.', '...GG.GG...'], { pulse: 1, drill: 1 }, 'unlock'],
        ['折射晶窗', '同一發最多削掉同一結晶一層。用泡泡的符號分辨鄰群。', 4, 'GPVAC',
            ['GGG.PPP.VVV', 'GG..PP..VV', '.X...X...X.', '.ACCCACAA.', '...VV.PP...', '..GGGG....'], { pulse: 2, rainbow: 1 }, 'unlock'],
        ['共鳴廊柱', '切斷結晶上方的連接，整根廊柱都能落下。', 4, 'CAVG',
            ['CCC.AAA.VVV', 'CC..AA..VV', 'XX..XX..XX.', '.G..GG..G.', 'GG.CCC.VVV.', '..AA..CC..'], { drill: 1, pulse: 1, rainbow: 1 }, 'unlock'],
        ['紫外鎖陣', '留意旁邊尚未消除的群組，別讓失手推低整面泡泡。', 4, 'ACPGV',
            ['AAACCCPGGVV', 'AA.CC.PGGV', '..X..X..X..', '.VV.PP.CC.', '.VVPGGGCCA.', '.GG..AA...', '....CC.....'], { drill: 1, pulse: 2, rainbow: 1 }, 'unlock'],
        ['暗面晶格', '先開一條可反彈的通道，再瞄準深處結晶。', 4, 'VPGAC',
            ['VVVPPPGGGAA', 'VV.PP.GGAA', '.X.X..X..X.', '.CCVCC.VP.', '..AGG..PP..', '..ACCC.AA.', '...VV.GG...'], { drill: 2, pulse: 1, rainbow: 1 }, 'unlock'],
        ['核心綻放', '解開所有結晶封鎖，讓光重新流過溫室。', 4, 'APCVG',
            ['XAAPPCCCVVX', 'XAPPPCCVVX', '.XX.X..X.X.', '.GG..GG.PP', '.GGVVGG.PP.', '..CC.AA.V.', '...AAGG....'], { drill: 2, pulse: 2, rainbow: 1 }, 'unlock']
    ].map(([name, hint, missLimit, order, rows, kit, goal], i) => Object.freeze({
        id: i + 1, name, hint, missLimit, order, rows: Object.freeze(rows), goal,
        sector: Math.floor(i / 6), kit: Object.freeze({ rainbow: 0, pulse: 0, drill: 0, ...kit })
    }));
    globalThis.LightbubbleLevels = Object.freeze({ levels: Object.freeze(levels), colors, tools, sectors });
})();
