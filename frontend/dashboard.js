// dashboard.js — Leaderboard & Live Games

const MOCK_PLAYERS = [
  { name:'CryptoKing',    tag:'legend',  color:'#FFD700', exp:94200, level:52, time:'1:23', prize:'⬡4,200', bet:'⬡25'  },
  { name:'0xPlatformer',  tag:'master',  color:'#ff3366', exp:78400, level:47, time:'1:31', prize:'⬡2,100', bet:'⬡15'  },
  { name:'ChainHero',     tag:'hero',    color:'#3399ff', exp:65100, level:41, time:'1:38', prize:'⬡980',  bet:'⬡10'  },
  { name:'BlockJumper',   tag:'warrior', color:'#aa44ff', exp:52800, level:35, time:'1:45', prize:'⬡450',  bet:'⬡5'   },
  { name:'ChainRunner',   tag:'hero',    color:'#3399ff', exp:41300, level:29, time:'1:52', prize:'⬡210',  bet:'⬡5'   },
  { name:'PixelVault',    tag:'warrior', color:'#aa44ff', exp:33900, level:24, time:'1:58', prize:'⬡140',  bet:'⬡5'   },
  { name:'LavaLord',      tag:'warrior', color:'#aa44ff', exp:28100, level:20, time:'2:04', prize:'⬡80',   bet:'⬡5'   },
  { name:'CrawlerSlayer',  tag:'novice',  color:'#00ff88', exp:19400, level:15, time:'2:12', prize:'⬡55',   bet:'⬡5'   },
  { name:'CoinCollector', tag:'novice',  color:'#00ff88', exp:12700, level:10, time:'2:19', prize:'⬡30',   bet:'⬡5'   },
  { name:'MushPlayer',    tag:'novice',  color:'#00ff88', exp:6800,  level:6,  time:'2:33', prize:'⬡0',    bet:'⬡5'   },
];

const MAX_EXP = MOCK_PLAYERS[0].exp;
const RANK_ICONS = ['🥇','🥈','🥉'];

function renderDashboard() {
  const body = document.getElementById('leaderboardBody');
  body.innerHTML = MOCK_PLAYERS.map((p, i) => {
    const isWinner = i === 0;
    return `
    <div class="lb-row ${isWinner ? 'winner-row' : ''}">
      <div class="lb-rank ${i < 3 ? 'r' + (i + 1) : ''}">${i < 3 ? RANK_ICONS[i] : i + 1}</div>
      <div class="lb-name-wrap">
        <div class="lb-avatar" style="background:${p.color}22;color:${p.color}">${p.name.substring(0,2).toUpperCase()}</div>
        <div>
          <div class="lb-name">${p.name}</div>
          <div class="exp-bar-wrap">
            <div class="exp-bar"><div class="exp-fill" style="width:${Math.round(p.exp/MAX_EXP*100)}%"></div></div>
            <div class="exp-pct">${Math.round(p.exp/MAX_EXP*100)}%</div>
          </div>
        </div>
        <span class="lb-tag tag-${p.tag}">${p.tag.toUpperCase()}</span>
      </div>
      <div class="lb-exp">${p.exp.toLocaleString()}</div>
      <div class="lb-time" style="color:var(--cyan)">${p.time}</div>
      <div style="color:var(--green)">Lv.${p.level}</div>
      <div style="color:var(--orange);font-weight:700">Bet: ${p.bet}</div>
      <div style="color:${isWinner ? 'var(--pixel)' : 'var(--muted)'};font-weight:${isWinner ? '700' : '400'}">${isWinner ? 'Win: ' + p.prize : '—'}</div>
    </div>`;
  }).join('');

  const liveData = [
    { name:'0xGhost',    level:'World 7', pct:45, bet:15, dur:4   },
    { name:'NeonJumper', level:'World 3', pct:72, bet:5,  dur:2.5 },
    { name:'ChainStar',  level:'World 10',pct:23, bet:100,dur:6   },
  ];
  document.getElementById('liveGrid').innerHTML = liveData.map(d => `
    <div class="live-card">
      <div class="live-player">${d.name}</div>
      <div class="live-info">${d.level} · ${d.pct}% complete</div>
      <div class="live-info" style="color:var(--pixel)">Bet: ⬡${d.bet} HBAR</div>
      <div class="live-prog">
        <div class="live-prog-fill" style="width:${d.pct}%;transition:width ${d.dur}s ease alternate;animation:none"></div>
      </div>
    </div>`).join('');
}
