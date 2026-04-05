// ============================================================
//  game.js — ChainRun Game Engine
//  Full physics, enemies, buffs, coins, rendering
// ============================================================

const TILE = 40;
const GRAVITY = 0.55;
const JUMP_FORCE = -13;
const MOVE_SPEED = 5;
const RUN_SPEED = 8;

const COLORS = {
  crawlers: '#A0522D', koopa: '#228B22', paratroopa: '#44BB44',
  bullet: '#333333', hammer: '#8B4513', boo: '#ffffff',
  thwomp: '#9944aa', chomp: '#111111', dragoon: '#CC4400',
  firebar: '#FF6600', lava: '#FF4400', spike: '#888888',
  coin: '#FFD700', pipe: '#00AA00', player: '#CC0000',
};

// ── Level Definitions ──────────────────────────────────────
const LEVELS = [
  { id:1,  num:'1-1', name:'Mushroom Plains',   diff:'easy',  color:'#00ff88', bet:5,   time:120, enemies:['crawlers'],                             obstacles:['pipe'],                    buffs:['mushroom','star'],      coinDensity:0.8, platformGap:80,  enemySpeed:1   },
  { id:2,  num:'1-2', name:'Cave Crawlers',     diff:'easy',  color:'#00cc66', bet:5,   time:110, enemies:['crawlers','koopa'],                      obstacles:['pipe','block'],             buffs:['mushroom','star'],      coinDensity:0.7, platformGap:100, enemySpeed:1.2 },
  { id:3,  num:'2-1', name:'Koopa Coast',       diff:'med',   color:'#ff8800', bet:10,  time:100, enemies:['koopa','crawlers'],                      obstacles:['pipe','cannon'],            buffs:['mushroom','fire'],      coinDensity:0.6, platformGap:130, enemySpeed:1.5 },
  { id:4,  num:'2-2', name:'Sky Platform',      diff:'med',   color:'#ffaa00', bet:10,  time:90,  enemies:['koopa','paratroopa'],                  obstacles:['gap','spikes'],             buffs:['fire','star'],          coinDensity:0.5, platformGap:160, enemySpeed:1.8 },
  { id:5,  num:'3-1', name:'Fire Kingdom',      diff:'med',   color:'#ff6600', bet:15,  time:85,  enemies:['koopa','paratroopa','hammer'],          obstacles:['firebar','lava'],           buffs:['star','1up'],           coinDensity:0.5, platformGap:180, enemySpeed:2   },
  { id:6,  num:'3-2', name:'Bullet Bill Blitz', diff:'hard',  color:'#ff3366', bet:20,  time:80,  enemies:['bullet','paratroopa'],                 obstacles:['cannon','firebar'],         buffs:['fire','star'],          coinDensity:0.4, platformGap:200, enemySpeed:2.5 },
  { id:7,  num:'4-1', name:'Haunted Mansion',   diff:'hard',  color:'#cc2255', bet:20,  time:75,  enemies:['boo','hammer','bullet'],               obstacles:['boo','spike','firebar'],    buffs:['star','1up'],           coinDensity:0.35,platformGap:220, enemySpeed:2.8 },
  { id:8,  num:'4-2', name:'Lava Fortress',     diff:'hard',  color:'#cc0033', bet:25,  time:70,  enemies:['hammer','thwomp','bullet'],            obstacles:['lava','thwomp','cannon'],   buffs:['1up','star'],           coinDensity:0.3, platformGap:240, enemySpeed:3   },
  { id:9,  num:'5-1', name:'Chain Chomp Ridge', diff:'super', color:'#aa44ff', bet:50,  time:60,  enemies:['chomp','thwomp','bullet','hammer'],    obstacles:['chomp','lava','spikes','firebar'], buffs:['star'],        coinDensity:0.25,platformGap:260, enemySpeed:3.5 },
  { id:10, num:'5-2', name:"Dragoon's Nightmare",diff:'super', color:'#8800ff', bet:100, time:50,  enemies:['dragoon','chomp','thwomp','bullet','hammer'], obstacles:['lava','firebar','cannon','spikes'], buffs:['star','1up'], coinDensity:0.2, platformGap:300, enemySpeed:4.5 },
];

const DIFF_CLASS = { easy:'diff-easy', med:'diff-med', hard:'diff-hard', super:'diff-super' };
const WEEKLY_PAYOUT_BY_DIFF = { easy: 0.8, med: 0.88, hard: 0.92, super: 0.96 };
const RARITY_ODDS_BY_DIFF = {
  easy: [
    { key: 'common', chance: 78.0 },
    { key: 'uncommon', chance: 18.0 },
    { key: 'rare', chance: 3.0 },
    { key: 'epic', chance: 0.9 },
    { key: 'legendary', chance: 0.099 },
    { key: 'rarest', chance: 0.001 },
  ],
  med: [
    { key: 'common', chance: 70.0 },
    { key: 'uncommon', chance: 20.0 },
    { key: 'rare', chance: 7.0 },
    { key: 'epic', chance: 2.0 },
    { key: 'legendary', chance: 0.999 },
    { key: 'rarest', chance: 0.001 },
  ],
  hard: [
    { key: 'common', chance: 60.0 },
    { key: 'uncommon', chance: 24.0 },
    { key: 'rare', chance: 11.0 },
    { key: 'epic', chance: 4.0 },
    { key: 'legendary', chance: 0.999 },
    { key: 'rarest', chance: 0.001 },
  ],
  super: [
    { key: 'common', chance: 48.0 },
    { key: 'uncommon', chance: 28.0 },
    { key: 'rare', chance: 17.0 },
    { key: 'epic', chance: 6.0 },
    { key: 'legendary', chance: 0.999 },
    { key: 'rarest', chance: 0.001 },
  ],
};
const MATERIALS_BY_RARITY = {
  common: ['Copper Core', 'Dust Shard', 'Leaf Fiber'],
  uncommon: ['Iron Bloom', 'Rune Bark', 'Quartz Vein'],
  rare: ['Aether Glass', 'Storm Pearl', 'Cinder Gem'],
  epic: ['Phantom Alloy', 'Void Crystal', 'Solar Thread'],
  legendary: ['Dragon Relic', 'Eclipse Heart', 'Titan Sigil'],
  rarest: ['Genesis Fragment'],
};
const NFT_REQUIREMENTS = { common: 25, uncommon: 12, rare: 6, epic: 3, legendary: 1, rarest: 1 };
const TRADE_ROUTES = [
  {
    id: 1,
    inputRarity: 'rarest',
    outputRarity: 'rare',
    outputQty: 3,
    feeHbar: 3.2,
    title: '1 SUPER RARE -> 3 RARE',
  },
  {
    id: 2,
    inputRarity: 'rarest',
    outputRarity: 'common',
    outputQty: 12,
    feeHbar: 1.4,
    title: '1 SUPER RARE -> 12 COMMON',
  },
];
const EGG_DROP_BY_DIFF = {
  easy: { common: 99.0, superRare: 1.0 },
  med:  { common: 96.0, superRare: 4.0 },
  hard: { common: 93.0, superRare: 7.0 },
  super: { common: 90.0, superRare: 10.0 },
};
const SUPER_RUNNER_EGG_RARE_ODDS_BY_DIFF = {
  easy: 1,
  med: 4,
  hard: 7,
  super: 10,
};
const EGG_ITEMS = {
  common: ['Shell Dust', 'Yolk Stone', 'Nest Fiber'],
  superRare: ['Phoenix Core', 'Astral Egg Relic', 'Mythic Hatch Sigil'],
};

function getTerrainPalette(diff) {
  if (diff === 'hard' || diff === 'super') {
    return {
      ground: '#5a3518',
      platformBody: '#8a623d',
      platformTop: '#7ee59a',
      platformStripe: '#603f25aa',
    };
  }
  return {
    ground: '#3a1f0a',
    platformBody: '#553311',
    platformTop: '#44bb66',
    platformStripe: '#44220088',
  };
}

let canvas, ctx, G = {}, RAF = null, gameTimer = null;
let selectedLevel = LEVELS[0];
let selectedChallengeType = 'normal';
let selectedChallengeId = null;
let selectedSessionId = null;
let activeChallenges = [];
let weeklyLeaderboard = [];
let lobbyRefreshInterval = null;
let weeklyCachedInfo = null;
let weeklyLastFetchMs = 0;
let demoWeeklyEndAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
let selectedWeeklyLevelId = 1;
let playerMaterialInventory = {};
let incubationSnapshot = [];
let eggCollectorSnapshot = { levelId: 1, count: 0, items: [] };
let marketViewTab = 'feed';
let currentDifficultyTuning = {
  enemySpawnMultiplier: 1,
  enemySpeedMultiplier: 1,
  platformGapMultiplier: 1,
  timeBonusSeconds: 0,
  label: 'normal',
};
const pressedKeys = new Set();

const DUMMY_INSTANT_ROOM = {
  id: 9001,
  levelId: 1,
  betTinybars: 0,
  maxPlayers: 4,
  playersCount: 1,
  isDummy: true,
};
const DUMMY_INSTANT_SESSION_ID = 'dummy-instant-session';

function isOnchainSessionId(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));
}

function isDummyInstantSession(sessionId = selectedSessionId, challengeId = selectedChallengeId) {
  return sessionId === DUMMY_INSTANT_SESSION_ID || challengeId === DUMMY_INSTANT_ROOM.id;
}

// ── Boot ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  renderLevelSelect();
  renderStartSubscriptionCard();
  bindKeys();
  syncIncubationProgress();
  syncEggCollectorBag();
  setInterval(renderIncubationInfo, 1000);
  setInterval(renderStartSubscriptionCard, 5000);
  setInterval(syncIncubationProgress, 10000);
  setInterval(syncEggCollectorBag, 12000);
  window.addEventListener('chainrun:wallet-updated', renderStartSubscriptionCard);
  window.addEventListener('chainrun:subscription-updated', renderStartSubscriptionCard);
});

function renderLevelSelect() {
  const g = document.getElementById('levelsGrid');
  g.innerHTML = LEVELS.map(l => `
    <div class="level-card" id="lvcard${l.id}"
      style="background:${l.color}11;border-color:${l.color}44"
      onclick="selectLevel(${l.id})">
      <div class="lnum" style="color:${l.color}">${l.num}</div>
      <div class="lname">${l.name}</div>
      <div class="ldiff ${DIFF_CLASS[l.diff]}">${l.diff.toUpperCase()}</div>
      <div class="lbet">⬡${l.bet} min bet</div>
      <div class="legg">🥚 ${getEggOddsForPlayer(l.diff).common}% C / ${getEggOddsForPlayer(l.diff).superRare}% SR</div>
    </div>`).join('');
  selectLevel(1);
  renderIncubationInfo();
}

function toggleIncubationInfo() {
  const panel = document.getElementById('incubationInfoPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  renderIncubationInfo();
}

function getIncubationMinutes(diff) {
  if (diff === 'easy') return 5;
  if (diff === 'med') return 8;
  if (diff === 'hard') return 12;
  return 16;
}

function getSubscriptionStatusCached() {
  const fallback = {
    tier: 'standard',
    isActive: false,
    bagLimitPerLevel: 10,
    maxActiveIntubations: 1,
    rareChanceByDifficulty: null,
    feeHbar: 12,
    expiresAt: null,
  };
  return window.BlockchainBridge?.getSubscriptionStatus?.() || fallback;
}

function getEggOddsForPlayer(diff) {
  const base = EGG_DROP_BY_DIFF[diff] || EGG_DROP_BY_DIFF.easy;
  const sub = getSubscriptionStatusCached();
  if (!sub?.isActive) return base;

  const boostedSuperRare = Number(sub.rareChanceByDifficulty?.[diff] ?? SUPER_RUNNER_EGG_RARE_ODDS_BY_DIFF[diff] ?? base.superRare);
  const safeSuperRare = Math.max(0, Math.min(100, boostedSuperRare));
  return {
    common: Number((100 - safeSuperRare).toFixed(3)),
    superRare: Number(safeSuperRare.toFixed(3)),
  };
}

function renderStartSubscriptionCard() {
  const root = document.getElementById('startSubscriptionCard');
  if (!root) return;

  const sub = getSubscriptionStatusCached();
  const bridge = window.BlockchainBridge;
  const connected = Boolean(bridge?.isWalletConnected?.());
  const isActive = Boolean(sub?.isActive);
  const isTrial = Boolean(sub?.isTrial);
  const trialAvailable = Boolean(connected && bridge?.canStartSuperRunnerTrial?.());
  const expires = isActive && sub?.expiresAt ? formatSubTimeLeft((sub.expiresAt || 0) - Date.now()) : null;
  const fee = Number(sub?.feeHbar || 12);

  root.innerHTML = `
    <div class="ssc-title">SUPER RUNNER</div>
    <div class="ssc-plan">${isActive ? `${isTrial ? 'Trial Active' : 'Active'}${expires ? ` · expires in ${expires}` : ''}` : 'Standard plan active'}</div>
    <div class="ssc-benefits">2 active incubations · 25 eggs per level bag · super-rare odds: Easy 1% · Med 4% · Hard 7% · Super 10%.</div>
    <div class="ssc-action">
      <div class="ssc-fee">⬡${fee}</div>
      <div class="ssc-buttons">
        <button class="ssc-btn" onclick="buySuperRunnerSubscription()" ${(!connected || isActive) ? 'disabled' : ''}>BUY</button>
        <button class="ssc-btn ssc-trial-btn" onclick="startSuperRunnerTrial()" ${(!trialAvailable || isActive) ? 'disabled' : ''}>FREE 7D TRIAL</button>
      </div>
    </div>
  `;

  if (connected && bridge?.ensureFreshSubscriptionStatus) {
    bridge.ensureFreshSubscriptionStatus()
      .then(() => {
        const latest = getSubscriptionStatusCached();
        const buyBtn = root.querySelector('.ssc-btn');
        const trialBtn = root.querySelector('.ssc-trial-btn');
        const plan = root.querySelector('.ssc-plan');
        if (buyBtn) buyBtn.disabled = Boolean(latest?.isActive);
        if (trialBtn) trialBtn.disabled = Boolean(!bridge?.canStartSuperRunnerTrial?.() || latest?.isActive);
        if (plan) {
          const latestTrial = Boolean(latest?.isTrial);
          plan.textContent = latest?.isActive
            ? `${latestTrial ? 'Trial Active' : 'Active'}${latest?.expiresAt ? ` · expires in ${formatSubTimeLeft((latest.expiresAt || 0) - Date.now())}` : ''}`
            : 'Standard plan active';
        }
      })
      .catch(() => {});
  }
}

async function syncIncubationProgress() {
  const bridge = window.BlockchainBridge;
  if (!bridge?.getMaterialIncubations || !bridge?.claimReadyMaterialIncubations) return;

  try {
    const claimed = await bridge.claimReadyMaterialIncubations();
    if (Array.isArray(claimed) && claimed.length) {
      for (const done of claimed) {
        if (done?.drop) addMaterialToInventory(done.drop);
      }
    }
    incubationSnapshot = await bridge.getMaterialIncubations();
    renderIncubationInfo();
    if (document.getElementById('marketPage')?.classList.contains('active')) {
      renderMarketPage();
    }
  } catch (err) {
    console.warn('Incubation sync failed:', err);
  }
}

async function syncEggCollectorBag() {
  const bridge = window.BlockchainBridge;
  if (!bridge?.getEggCollectorBag) return;

  try {
    eggCollectorSnapshot = await bridge.getEggCollectorBag(selectedLevel?.id || 1);
    renderIncubationInfo();
  } catch (err) {
    console.warn('Egg collector sync failed:', err);
  }
}

function formatHatchCountdown(msLeft) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

async function intubateEggFromPopup() {
  const bag = eggCollectorSnapshot || { count: 0, items: [] };
  if ((bag.count || 0) <= 0) {
    alert('No egg available in EggCollector bag for this level.');
    return;
  }

  const now = Date.now();
  const sub = getSubscriptionStatusCached();
  const maxActive = Number(sub?.maxActiveIntubations || 1);
  const activeCount = (incubationSnapshot || []).filter(i => !i.claimed && (i.readyAt || 0) > now).length;
  if (activeCount >= maxActive) {
    alert(`You can incubate up to ${maxActive} egg(s) at a time on your current plan.`);
    return;
  }

  const chosenDrop = (Array.isArray(bag.items) && bag.items.length)
    ? bag.items[0]
    : {
        name: `EggCollector L${selectedLevel?.id || 1}`,
        rarity: 'common',
        levelId: selectedLevel?.id || 1,
        difficulty: selectedLevel?.diff || 'med',
        mintCost: 0,
        source: 'eggcollector',
      };

  try {
    await window.BlockchainBridge?.intubateEggFromBag?.(chosenDrop, selectedLevel.id);
    await syncIncubationProgress();
    await syncEggCollectorBag();
    alert('Incubation started. Egg will hatch in 3 days.');
  } catch (err) {
    console.error('Failed to start egg incubation:', err);
    const reason = err?.reason || err?.error?.message || err?.message || 'Unknown error';
    alert(`Unable to start incubation: ${reason}`);
  }
}

function renderIncubationInfo() {
  const panel = document.getElementById('incubationInfoPanel');
  if (!panel) return;

  const diff = selectedLevel?.diff || 'easy';
  const odds = getEggOddsForPlayer(diff);
  const sub = getSubscriptionStatusCached();
  const bagLimit = Number(sub?.bagLimitPerLevel || 10);
  const maxActive = Number(sub?.maxActiveIntubations || 1);
  const planLabel = sub?.isActive ? 'SUPER RUNNER' : 'STANDARD';
  const rows = [
    { tier: 'Common', prob: odds.common, items: EGG_ITEMS.common.join(', ') },
    { tier: 'Super Rare', prob: odds.superRare, items: EGG_ITEMS.superRare.join(', ') },
  ];
  const now = Date.now();
  const activeCount = (incubationSnapshot || []).filter(i => (i.readyAt || 0) > now).length;
  const active = (incubationSnapshot || []).find(i => !i.claimed && (i.readyAt || 0) > now);
  const bagCount = Number(eggCollectorSnapshot?.count || 0);
  const hatchLine = active
    ? `Hatching in: ${formatHatchCountdown((active.readyAt || now) - now)}`
    : 'No active incubation.';
  const buttonDisabled = activeCount >= maxActive || bagCount <= 0 ? 'disabled' : '';

  panel.innerHTML = `
    <div class="incub-title">INCUBATION DETAILS</div>
    <div class="incub-meta">Plan: ${planLabel}</div>
    <div class="incub-meta">Difficulty: ${diff.toUpperCase()} · Hatch duration: 3 days</div>
    <div class="incub-meta">EggCollector Bag (Level ${selectedLevel?.num || selectedLevel?.id || 1}): ${bagCount}/${bagLimit}</div>
    <div class="incub-meta">Active incubations: ${activeCount}/${maxActive}</div>
    <div class="incub-meta">${hatchLine}</div>
    <button class="lobby-btn" style="width:100%;margin:8px 0 10px" onclick="intubateEggFromPopup()" ${buttonDisabled}>INCUBATE EGG</button>
    ${rows.map(r => `
      <div class="incub-row">
        <div class="incub-tier">${r.tier}</div>
        <div class="incub-prob">${r.prob}%</div>
        <div class="incub-items">${r.items}</div>
      </div>
    `).join('')}
  `;
}

function onChallengeModeChange(mode) {
  selectedChallengeType = mode;
  selectedChallengeId = null;
  selectedSessionId = null;
  document.getElementById('challengeStatus').textContent = 'Challenge status will appear here.';
  document.getElementById('instantOptions').classList.toggle('hidden', mode !== 'instant');
  document.getElementById('weeklyOptions').classList.toggle('hidden', mode !== 'weekly');
}

function toggleModeDropdown() {
  const wrapper = document.querySelector('.mode-dropdown-wrapper');
  wrapper.classList.toggle('active');
}

function selectMode(mode) {
  selectedChallengeType = mode;
  selectedChallengeId = null;
  selectedSessionId = null;
  weeklyCachedInfo = null;
  weeklyLastFetchMs = 0;
  
  if (lobbyRefreshInterval) {
    clearInterval(lobbyRefreshInterval);
    lobbyRefreshInterval = null;
  }
  
  const wrapper = document.querySelector('.mode-dropdown-wrapper');
  wrapper.classList.remove('active');
  
  const modeText = {
    normal: 'Normal',
    instant: 'Instant ⚡',
    weekly: 'Weekly 🏆'
  };
  document.getElementById('modeDropdownText').textContent = modeText[mode];
  
  document.getElementById('instantChallengeLobby').classList.toggle('hidden', mode !== 'instant');
  document.getElementById('weeklyChallengePanel').classList.toggle('hidden', mode !== 'weekly');
  
  if (mode === 'instant') {
    refreshChallengeLobby();
    lobbyRefreshInterval = setInterval(refreshChallengeLobby, 3000);
  } else if (mode === 'weekly') {
    selectedWeeklyLevelId = selectedLevel?.id || 1;
    updateWeeklyPanel(true);
    lobbyRefreshInterval = setInterval(() => updateWeeklyPanel(false), 1000);
  }
}

async function refreshChallengeLobby() {
  const list = document.getElementById('challengesList');
  const noMsg = document.getElementById('noRoomsMsg');
  
  try {
    const onchain = await window.BlockchainBridge?.getActiveChallenges?.();
    activeChallenges = Array.isArray(onchain) ? onchain : [];

    if (!activeChallenges.length) {
      activeChallenges = [DUMMY_INSTANT_ROOM];
    }

    if (!activeChallenges.length) {
      noMsg.style.display = 'block';
      list.innerHTML = '';
      return;
    }

    noMsg.style.display = 'none';
    list.innerHTML = activeChallenges.map((ch, idx) => {
      const isFull = ch.playersCount >= ch.maxPlayers;
      const isDummy = ch.isDummy;
      return `
      <div class="challenge-room ${isFull ? 'room-full' : ''} ${isDummy ? 'dummy-room' : ''}" 
           ${isFull ? '' : `onclick="showJoinRoomUI(${idx})"`}>
        <div class="room-id">#${ch.id}${isDummy ? ' (DEMO)' : ''}</div>
        <div class="room-level">L${ch.levelId}</div>
        <div class="room-bet">⬡${ch.betTinybars / 1e8}</div>
        <div class="room-players">${ch.playersCount}/${ch.maxPlayers}</div>
        <button class="lobby-btn" style="width:60px" ${isFull ? 'disabled' : ''} 
                onclick="event.stopPropagation(); joinInstantChallenge(${ch.id})">
          ${isFull ? 'FULL' : 'JOIN'}
        </button>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.warn('Failed to fetch challenges:', err);
    activeChallenges = [DUMMY_INSTANT_ROOM];
    noMsg.style.display = 'none';
    list.innerHTML = activeChallenges.map((ch, idx) => {
      const isFull = ch.playersCount >= ch.maxPlayers;
      return `
      <div class="challenge-room ${isFull ? 'room-full' : ''} dummy-room" 
           ${isFull ? '' : `onclick="showJoinRoomUI(${idx})"`}>
        <div class="room-id">#${ch.id} (DEMO)</div>
        <div class="room-level">L${ch.levelId}</div>
        <div class="room-bet">⬡${ch.betTinybars / 1e8}</div>
        <div class="room-players">${ch.playersCount}/${ch.maxPlayers}</div>
        <button class="lobby-btn" style="width:60px" ${isFull ? 'disabled' : ''} 
                onclick="event.stopPropagation(); joinInstantChallenge(${ch.id})">
          ${isFull ? 'FULL' : 'JOIN'}
        </button>
      </div>
    `;
    }).join('');
  }
}

async function createInstantChallenge() {
  const maxPlayers = parseInt(document.getElementById('instantMaxPlayers').value) || 3;
  const bet = parseFloat(document.getElementById('betAmount').value) || 0;
  
  if (bet < selectedLevel.bet) {
    alert(`Minimum bet is ⬡${selectedLevel.bet} HBAR`);
    return;
  }
  if (maxPlayers < 2 || maxPlayers > 5) {
    alert('Instant challenge supports 2 to 5 players.');
    return;
  }

  try {
    const result = await window.BlockchainBridge.createInstantChallenge(selectedLevel.id, maxPlayers, bet);
    selectedChallengeId = result.challengeId;
    selectedSessionId = result.sessionId;
    selectedChallengeType = 'instant';
    
    document.querySelector('.mode-dropdown-wrapper').classList.remove('active');
    startGame();
  } catch (err) {
    console.error('Failed to create instant challenge:', err);
    alert('Could not create instant challenge. Check wallet or contract status.');
  }
}

async function joinInstantChallenge(challengeId) {
  const bet = parseFloat(document.getElementById('betAmount').value) || 0;

  if (challengeId === DUMMY_INSTANT_ROOM.id) {
    selectedChallengeId = DUMMY_INSTANT_ROOM.id;
    selectedSessionId = DUMMY_INSTANT_SESSION_ID;
    selectedChallengeType = 'instant';
    document.querySelector('.mode-dropdown-wrapper').classList.remove('active');
    startGame();
    return;
  }
  
  if (bet < selectedLevel.bet) {
    alert(`Minimum bet is ⬡${selectedLevel.bet} HBAR`);
    return;
  }

  try {
    const result = await window.BlockchainBridge.joinInstantChallenge(challengeId, bet);
    selectedChallengeId = result.challengeId;
    selectedSessionId = result.sessionId;
    selectedChallengeType = 'instant';
    
    document.querySelector('.mode-dropdown-wrapper').classList.remove('active');
    startGame();
  } catch (err) {
    console.error('Failed to join instant challenge:', err);
    alert('Unable to join instant challenge. Room may be full or bet mismatch.');
  }
}

function toggleWeeklyLeaderboard() {
  const header = document.getElementById('weeklyLeaderboardHeader');
  const list = document.getElementById('weeklyLeaderboard');
  if (!header || !list) return;

  const collapsed = list.classList.toggle('collapsed');
  header.classList.toggle('collapsed', collapsed);
  header.textContent = collapsed ? 'CURRENT STANDINGS ▶' : 'CURRENT STANDINGS ▼';
}

function formatCountdown(secondsLeft) {
  const total = Math.max(0, Math.floor(secondsLeft));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function getPayoutShare(level) {
  return WEEKLY_PAYOUT_BY_DIFF[level.diff] || 0.8;
}

function rollRarity(diff) {
  const table = RARITY_ODDS_BY_DIFF[diff] || RARITY_ODDS_BY_DIFF.med;
  const roll = Math.random() * 100;
  let running = 0;
  for (const r of table) {
    running += r.chance;
    if (roll <= running) return r.key;
  }
  return 'common';
}

function pickMaterial(rarity) {
  const pool = MATERIALS_BY_RARITY[rarity] || MATERIALS_BY_RARITY.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

function mintMaterialForLevel(level, baseBet) {
  const rarity = rollRarity(level.diff);
  return {
    name: pickMaterial(rarity),
    rarity,
    levelId: level.id,
    difficulty: level.diff,
    mintCost: Math.max(1, Math.round(baseBet * 0.2)),
  };
}

function addMaterialToInventory(drop) {
  const key = `${drop.name}|${drop.rarity}`;
  if (!playerMaterialInventory[key]) {
    playerMaterialInventory[key] = { ...drop, qty: 0 };
  }
  playerMaterialInventory[key].qty += 1;
}

function rollEggDrop(diff) {
  const odds = getEggOddsForPlayer(diff);
  const roll = Math.random() * 100;
  return roll <= odds.superRare ? 'superRare' : 'common';
}

function formatSubTimeLeft(msLeft) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return `${days}d ${String(hours).padStart(2, '0')}h`;
}

async function buySuperRunnerSubscription() {
  const sub = await (window.BlockchainBridge?.ensureFreshSubscriptionStatus?.() || getSubscriptionStatusCached());
  if (sub?.isActive) {
    alert('Super Runner subscription is already active.');
    return;
  }

  const fee = Number(sub?.feeHbar || 12);
  const approved = window.confirm(
    `Buy SUPER RUNNER subscription for ⬡${fee}?\n\nBenefits:\n- 2 simultaneous egg incubations\n- 25 eggs bag limit per level\n- Super-rare odds: Easy 1% · Med 4% · Hard 7% · Super 10%`
  );
  if (!approved) return;

  try {
    await window.BlockchainBridge?.purchaseSuperRunnerSubscription?.();
    await syncEggCollectorBag();
    await syncIncubationProgress();
    renderLevelSelect();
    renderStartSubscriptionCard();
    renderMarketPage();
    alert('Super Runner subscription activated successfully.');
  } catch (err) {
    console.error('Subscription purchase failed:', err);
    const reason = err?.reason || err?.error?.message || err?.message || 'Unknown error';
    alert(`Subscription purchase failed: ${reason}`);
  }
}

async function startSuperRunnerTrial() {
  const connected = Boolean(window.BlockchainBridge?.isWalletConnected?.());
  if (!connected) {
    alert('Connect wallet first to activate the free trial.');
    return;
  }

  const approved = window.confirm(
    'Activate FREE SUPER RUNNER trial for 7 days?\n\nThis trial can be used once per wallet.'
  );
  if (!approved) return;

  try {
    await window.BlockchainBridge?.startSuperRunnerTrial?.();
    await syncEggCollectorBag();
    await syncIncubationProgress();
    renderLevelSelect();
    renderStartSubscriptionCard();
    renderMarketPage();
    alert('Free 7-day Super Runner trial activated.');
  } catch (err) {
    console.error('Trial activation failed:', err);
    const reason = err?.reason || err?.error?.message || err?.message || 'Unknown error';
    alert(`Trial activation failed: ${reason}`);
  }
}

function mintEggMaterial(level, baseBet) {
  const tier = rollEggDrop(level.diff);
  const pool = EGG_ITEMS[tier];
  return {
    name: pool[Math.floor(Math.random() * pool.length)],
    rarity: tier === 'superRare' ? 'rarest' : 'common',
    levelId: level.id,
    difficulty: level.diff,
    mintCost: Math.max(1, Math.round(baseBet * 0.1)),
    source: 'egg',
  };
}

function buildDummyWeeklyInfo() {
  const levelBoards = {};
  let totalPoolTinybars = 0;
  let totalParticipants = 0;

  LEVELS.forEach(level => {
    const playerCount = 4 + Math.floor(Math.random() * 3);
    const base = level.bet;
    const entries = Array.from({ length: playerCount }, (_, idx) => {
      const bet = Number((base * (1 + Math.random() * 1.2)).toFixed(1));
      const bestTime = Number((Math.max(20, level.time * (0.35 + Math.random() * 0.6))).toFixed(1));
      const material = mintMaterialForLevel(level, bet);
      return {
        player: `0x${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`,
        bestTime,
        points: Math.max(100, Math.round((playerCount - idx) * 150 + Math.random() * 60)),
        bet,
        material,
      };
    }).sort((a, b) => a.bestTime - b.bestTime);

    const pool = entries.reduce((sum, e) => sum + e.bet, 0);
    const payoutShare = getPayoutShare(level);
    entries[0].winnings = Number((pool * payoutShare).toFixed(1));
    entries[0].material = mintMaterialForLevel(level, entries[0].bet);
    addMaterialToInventory(entries[0].material);

    levelBoards[level.id] = {
      levelId: level.id,
      levelNum: level.num,
      difficulty: level.diff,
      payoutShare,
      totalPool: pool,
      leaderboard: entries,
    };

    totalPoolTinybars += Math.round(pool * 1e8);
    totalParticipants += playerCount;
  });

  return {
    id: 1,
    endAt: demoWeeklyEndAt,
    totalPool: totalPoolTinybars,
    participantCount: totalParticipants,
    levelBoards,
  };
}

function selectWeeklyStandingLevel(levelId) {
  selectedWeeklyLevelId = levelId;
  renderWeeklyBoardFromCache();
}

function renderWeeklyBoardFromCache() {
  const weekInfo = weeklyCachedInfo;
  if (!weekInfo || !weekInfo.levelBoards) return;

  const selectedBoard = weekInfo.levelBoards[selectedWeeklyLevelId] || weekInfo.levelBoards[1];
  const levelBoardEl = document.getElementById('weeklyLevelBoards');
  const rewardInfoEl = document.getElementById('weeklyRewardInfo');
  const listEl = document.getElementById('weeklyLeaderboard');

  levelBoardEl.innerHTML = LEVELS.map(level => {
    const board = weekInfo.levelBoards[level.id];
    const top = board?.leaderboard?.[0];
    const active = level.id === selectedBoard.levelId;
    return `
      <div class="weekly-level-chip ${active ? 'active' : ''}" onclick="selectWeeklyStandingLevel(${level.id})">
        <div class="num">${level.num}</div>
        <div class="meta"><span>${level.diff.toUpperCase()}</span><span>${top ? top.bestTime.toFixed(1) + 's' : '--'}</span></div>
      </div>
    `;
  }).join('');

  rewardInfoEl.innerHTML = `
    <div>Level ${selectedBoard.levelNum} · ${selectedBoard.difficulty.toUpperCase()} payout: <strong>${Math.round(selectedBoard.payoutShare * 100)}%</strong> of total bet</div>
    <div>Egg drops (${selectedBoard.difficulty.toUpperCase()}): <strong>${getEggOddsForPlayer(selectedBoard.difficulty).common}% Common</strong> / <strong>${getEggOddsForPlayer(selectedBoard.difficulty).superRare}% Super Rare</strong></div>
  `;

  if (!selectedBoard.leaderboard || selectedBoard.leaderboard.length === 0) {
    listEl.innerHTML = '<div class="empty-msg">No participants yet</div>';
    return;
  }

  listEl.innerHTML = selectedBoard.leaderboard.slice(0, 10).map((entry, idx) => `
    <div class="leaderboard-entry">
      <div class="rank-badge rank-${idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : 'other'}">${idx + 1}</div>
      <div class="player-name">${entry.player.slice(0, 8)}...${entry.player.slice(-4)} · ${entry.material?.name || 'No drop'}</div>
      <div class="best-time">${Number(entry.bestTime || 0).toFixed(1)}s</div>
      <div class="week-bet">⬡${Number(entry.bet || 0).toFixed(1)}</div>
      <div class="week-winnings">${idx === 0 ? ('⬡' + Number(entry.winnings || 0).toFixed(1)) : '—'}</div>
    </div>
  `).join('');
}

async function updateWeeklyPanel(forceFetch = false) {
  try {
    const nowMs = Date.now();
    const shouldFetch = forceFetch || !weeklyCachedInfo || (nowMs - weeklyLastFetchMs >= 5000);

    if (shouldFetch) {
      const onchainInfo = await window.BlockchainBridge?.getWeeklyInfo?.(selectedLevel.id);
      weeklyCachedInfo = (onchainInfo && onchainInfo.levelBoards) ? onchainInfo : buildDummyWeeklyInfo();
      weeklyLastFetchMs = nowMs;
    }

    const weekInfo = weeklyCachedInfo || buildDummyWeeklyInfo();
    const nowSec = Date.now() / 1000;
    const timeLeft = Math.max(0, (weekInfo.endAt || demoWeeklyEndAt) - nowSec);

    document.getElementById('weekNumber').textContent = `Week ${weekInfo.id || 1}`;
    document.getElementById('weekTimeLeft').textContent = formatCountdown(timeLeft);
    document.getElementById('weeklyPoolTotal').textContent = `⬡${((weekInfo.totalPool || 0) / 1e8).toFixed(1)}`;
    document.getElementById('weeklyParticipants').textContent = weekInfo.participantCount || '0';

    const header = document.getElementById('weeklyLeaderboardHeader');
    if (header && header.textContent.trim() === 'CURRENT STANDINGS') {
      header.textContent = 'CURRENT STANDINGS ▼';
    }

    renderWeeklyBoardFromCache();
  } catch (err) {
    console.warn('Failed to load weekly info:', err);
    weeklyCachedInfo = buildDummyWeeklyInfo();
    renderWeeklyBoardFromCache();
  }
}

async function joinWeeklyChallenge() {
  const bet = parseFloat(document.getElementById('betAmount').value) || 0;
  
  if (bet < selectedLevel.bet) {
    alert(`Minimum bet is ⬡${selectedLevel.bet} HBAR`);
    return;
  }

  try {
    const result = await window.BlockchainBridge.joinWeeklyChallenge(selectedLevel.id, bet);
    selectedChallengeId = result.weeklyId;
    selectedSessionId = result.sessionId;
    selectedChallengeType = 'weekly';
    
    document.querySelector('.mode-dropdown-wrapper').classList.remove('active');
    startGame();
  } catch (err) {
    console.error('Failed to join weekly challenge:', err);
    alert('Unable to join weekly challenge. Check wallet or contract status.');
  }
}

function selectLevel(id) {
  selectedLevel = LEVELS.find(l => l.id === id);
  selectedWeeklyLevelId = id;
  document.querySelectorAll('.level-card').forEach(c => c.style.boxShadow = '');
  document.getElementById('lvcard' + id).style.boxShadow = `0 0 20px ${selectedLevel.color}`;
  document.getElementById('betAmount').value = selectedLevel.bet;
  updatePoolStatus();
  if (selectedChallengeType === 'weekly') {
    updateWeeklyPanel(true);
  }
  syncEggCollectorBag();
  renderIncubationInfo();
}

async function updatePoolStatus() {
  const poolEl = document.getElementById('poolStatus');
  if (!poolEl || !window.BlockchainBridge?.getLevelPool) return;
  try {
    const pool = await window.BlockchainBridge.getLevelPool(selectedLevel.id);
    poolEl.textContent = `Prize Pool: ⬡${pool}`;
  } catch (err) {
    poolEl.textContent = 'Prize Pool: unavailable';
  }
}

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id + 'Page').classList.add('active');
  btn.classList.add('active');
  if (id === 'dash') renderDashboard();
  if (id === 'market') {
    setMarketViewTab(marketViewTab || 'feed');
  }
}

function openMarketFromHome() {
  const marketTab = Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.includes('MARKET'));
  if (marketTab) {
    showPage('market', marketTab);
  }
}

function rarityClass(rarity) {
  return `rarity-${rarity || 'common'}`;
}

function setMarketViewTab(tab) {
  marketViewTab = tab === 'trade' ? 'trade' : 'feed';
  const feedTab = document.getElementById('marketFeedTab');
  const tradeTab = document.getElementById('marketTradeTab');
  const feedPanels = ['marketFeedPanel', 'marketInventoryPanel', 'marketNftPanel']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const tradePanel = document.getElementById('marketTradePanel');

  if (feedTab) feedTab.classList.toggle('active', marketViewTab === 'feed');
  if (tradeTab) tradeTab.classList.toggle('active', marketViewTab === 'trade');
  feedPanels.forEach(panel => panel.classList.toggle('hidden', marketViewTab !== 'feed'));
  if (tradePanel) tradePanel.classList.toggle('hidden', marketViewTab !== 'trade');

  renderMarketPage();
}

function getInventoryQtyByRarity(rarity) {
  return Object.values(playerMaterialInventory)
    .filter(item => item.rarity === rarity)
    .reduce((sum, item) => sum + (item.qty || 0), 0);
}

function consumeInventoryByRarity(rarity, qty) {
  let remaining = Math.max(0, Number(qty || 0));
  for (const key of Object.keys(playerMaterialInventory)) {
    if (remaining <= 0) break;
    const item = playerMaterialInventory[key];
    if (!item || item.rarity !== rarity || item.qty <= 0) continue;
    const used = Math.min(item.qty, remaining);
    item.qty -= used;
    remaining -= used;
    if (item.qty <= 0) {
      delete playerMaterialInventory[key];
    }
  }
  return remaining === 0;
}

async function executeMarketTrade(routeId) {
  const route = TRADE_ROUTES.find(r => r.id === routeId);
  if (!route) return;

  if (!window.BlockchainBridge?.isWalletConnected?.()) {
    alert('Connect your wallet to execute crypto trade payment.');
    return;
  }

  const chainSuperRare = await window.BlockchainBridge?.getMaterialBalance?.(5);
  if ((Number(chainSuperRare) || 0) < 1) {
    alert('On-chain Super Rare balance is insufficient. Incubate and claim a super rare material first.');
    return;
  }

  const approved = window.confirm(
    `${route.title}\n\nWallet fee: ⬡${route.feeHbar}\nProceed with trade?`
  );
  if (!approved) return;

  const statusEl = document.getElementById('marketTradeStatus');
  if (statusEl) statusEl.textContent = 'Processing wallet payment...';

  try {
    await window.BlockchainBridge.payMarketTrade(route.feeHbar, route.id);

    consumeInventoryByRarity(route.inputRarity, 1);
    for (let i = 0; i < route.outputQty; i++) {
      addMaterialToInventory({
        name: pickMaterial(route.outputRarity),
        rarity: route.outputRarity,
        levelId: selectedLevel?.id || 1,
        difficulty: selectedLevel?.diff || 'med',
        mintCost: 0,
        source: 'trade-desk'
      });
    }

    if (statusEl) {
      statusEl.textContent = `Trade complete: paid ⬡${route.feeHbar}, received ${route.outputQty} ${route.outputRarity}.`;
    }
    renderMarketPage();
  } catch (err) {
    console.error('Trade payment failed:', err);
    if (statusEl) {
      statusEl.textContent = 'Trade failed: wallet payment was rejected or reverted.';
    }
    alert('Trade payment failed. Please check wallet confirmation and balance.');
  }
}

function renderMarketPage() {
  if (!weeklyCachedInfo) {
    weeklyCachedInfo = buildDummyWeeklyInfo();
  }

  const listingsEl = document.getElementById('marketListings');
  const inventoryEl = document.getElementById('marketInventory');
  const nftProgressEl = document.getElementById('nftProgress');
  const tradeStatusEl = document.getElementById('marketTradeStatus');
  const tradeRoutesEl = document.getElementById('marketTradeRoutes');
  if (!listingsEl || !inventoryEl || !nftProgressEl) return;

  const inventoryItems = Object.values(playerMaterialInventory);
  const now = Date.now();
  const incubatingNow = (incubationSnapshot || []).filter(i => (i.readyAt || 0) > now);
  const topListings = Object.values(weeklyCachedInfo.levelBoards || {}).slice(0, 10).map(board => {
    const winner = board.leaderboard?.[0];
    return winner ? {
      material: winner.material?.name || 'Unknown Material',
      rarity: winner.material?.rarity || 'common',
      price: Number((winner.bet * (1.1 + Math.random() * 0.6)).toFixed(1)),
      levelNum: board.levelNum,
    } : null;
  }).filter(Boolean);

  listingsEl.innerHTML = topListings.map(item => `
    <div class="market-row">
      <div class="material ${rarityClass(item.rarity)}">${item.material} · ${item.levelNum}</div>
      <div class="rarity ${rarityClass(item.rarity)}">${item.rarity}</div>
      <div class="price">⬡${item.price}</div>
    </div>
  `).join('');

  const incubatingBlock = incubatingNow.length
    ? `<div class="empty-msg">Incubating: ${incubatingNow.length} item(s) in progress</div>`
    : '';

  inventoryEl.innerHTML = (inventoryItems.length ? inventoryItems.map(item => `
    <div class="market-row">
      <div class="material ${rarityClass(item.rarity)}">${item.name}</div>
      <div class="rarity ${rarityClass(item.rarity)}">${item.rarity}</div>
      <div class="price">x${item.qty}</div>
    </div>
  `).join('') : '<div class="empty-msg">No materials minted yet. Play weekly to earn drops.</div>') + incubatingBlock;

  nftProgressEl.innerHTML = Object.entries(NFT_REQUIREMENTS).map(([rarity, need]) => {
    const owned = inventoryItems.filter(i => i.rarity === rarity).reduce((sum, i) => sum + i.qty, 0);
    const ready = owned >= need;
    return `<div class="nft-req"><span class="${rarityClass(rarity)}">${rarity.toUpperCase()}</span><span class="${ready ? 'ok' : 'need'}">${owned}/${need}</span></div>`;
  }).join('');

  if (tradeStatusEl && tradeRoutesEl) {
    const walletReady = window.BlockchainBridge?.isWalletConnected?.();
    const superRareOwned = getInventoryQtyByRarity('rarest');
    const sub = getSubscriptionStatusCached();
    const subState = sub?.isActive
      ? `ACTIVE · expires in ${formatSubTimeLeft((sub.expiresAt || 0) - Date.now())}`
      : 'INACTIVE';
    tradeStatusEl.textContent = walletReady
      ? `Wallet connected. Local Super Rare: ${superRareOwned} (checking on-chain...)`
      : 'Connect wallet and hold Super Rare materials to trade.';

    if (walletReady && window.BlockchainBridge?.getMaterialBalance) {
      window.BlockchainBridge.getMaterialBalance(5)
        .then(onchainBal => {
          const val = Number(onchainBal) || 0;
          if (tradeStatusEl) {
            tradeStatusEl.textContent = `Wallet connected. On-chain Super Rare balance: ${val}`;
          }
        })
        .catch(() => {
          if (tradeStatusEl) {
            tradeStatusEl.textContent = `Wallet connected. Unable to fetch on-chain material balances.`;
          }
        });
    }

    tradeRoutesEl.innerHTML = TRADE_ROUTES.map(route => {
      const disabled = !walletReady ? 'disabled' : '';
      return `
        <div class="trade-route">
          <div class="trade-route-title">${route.title}</div>
          <div class="trade-route-meta">
            Input: 1 Super Rare<br>
            Output: ${route.outputQty} ${route.outputRarity}<br>
            Wallet Fee: ⬡${route.feeHbar}
          </div>
          <button class="lobby-btn" onclick="executeMarketTrade(${route.id})" ${disabled}>EXECUTE TRADE</button>
        </div>
      `;
    }).join('') + `
      <div class="trade-route" style="border-color:${sub?.isActive ? 'var(--green)' : '#4f567a'}">
        <div class="trade-route-title">🏷 SUPER RUNNER SUBSCRIPTION</div>
        <div class="trade-route-meta">
          Status: ${subState}<br>
          Bag limit: ${sub?.isActive ? 25 : 10} eggs per level<br>
          Active incubations: ${sub?.isActive ? 2 : 1}<br>
          Egg super rare chance: Easy 1% · Med 4% · Hard 7% · Super 10%
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="lobby-btn" onclick="buySuperRunnerSubscription()" ${(!walletReady || sub?.isActive) ? 'disabled' : ''}>BUY SUPER RUNNER</button>
          <button class="lobby-btn" onclick="startSuperRunnerTrial()" ${(!walletReady || sub?.isActive || !window.BlockchainBridge?.canStartSuperRunnerTrial?.()) ? 'disabled' : ''}>FREE 7D TRIAL</button>
        </div>
      </div>
    `;
  }
}

function craftWeeklyNft() {
  const inventoryItems = Object.values(playerMaterialInventory);
  const canCraft = Object.entries(NFT_REQUIREMENTS).every(([rarity, need]) => {
    const owned = inventoryItems.filter(i => i.rarity === rarity).reduce((sum, i) => sum + i.qty, 0);
    return owned >= need;
  });

  if (!canCraft) {
    alert('Not enough materials to mint Collector NFT yet.');
    return;
  }

  Object.entries(NFT_REQUIREMENTS).forEach(([rarity, need]) => {
    let remaining = need;
    for (const key of Object.keys(playerMaterialInventory)) {
      const item = playerMaterialInventory[key];
      if (item.rarity !== rarity || remaining <= 0) continue;
      const used = Math.min(item.qty, remaining);
      item.qty -= used;
      remaining -= used;
    }
  });

  alert('Collector NFT minted successfully from your material set!');
  renderMarketPage();
}

// ── Key bindings ───────────────────────────────────────────
function bindKeys() {
  document.addEventListener('keydown', e => {
    pressedKeys.add(e.code);
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyZ' && G.player && G.player.hasFireFlower) shootFireball();
  });
  document.addEventListener('keyup', e => pressedKeys.delete(e.code));
}

// ── Start ──────────────────────────────────────────────────
async function startGame() {
  const bet = parseFloat(document.getElementById('betAmount').value) || 0;
  if (bet < selectedLevel.bet) { alert(`Minimum bet is ⬡${selectedLevel.bet} HBAR`); return; }

  if (selectedChallengeType !== 'normal' && !selectedSessionId) {
    alert('Please create or join the selected challenge before starting the level.');
    return;
  }
  if (selectedChallengeType !== 'normal' && !isDummyInstantSession() && !isOnchainSessionId(selectedSessionId)) {
    alert('Challenge session is invalid. Rejoin the on-chain challenge and try again.');
    selectedSessionId = null;
    return;
  }

  if (lobbyRefreshInterval) {
    clearInterval(lobbyRefreshInterval);
    lobbyRefreshInterval = null;
  }

  try {
    if (selectedChallengeType === 'normal') {
      const sessionId = await window.BlockchainBridge?.startGameSession(selectedLevel.id, bet);
      console.log('Blockchain session started:', sessionId);
      selectedSessionId = sessionId;
    }
  } catch (err) {
    console.error('Blockchain session failed:', err);
    const reason = err?.reason || err?.error?.message || err?.message || 'Unknown error';
    alert(`Blockchain session could not be opened: ${reason}`);
    return;
  }

  document.getElementById('levelSelect').style.display = 'none';
  document.getElementById('gameHud').style.display = 'flex';
  document.getElementById('gameCanvas').style.display = 'block';
  document.getElementById('keysHint').style.display = 'block';
  document.getElementById('powerBar').style.display = 'block';
  document.getElementById('hudWorld').textContent = selectedLevel.num;
  
  const hintText = document.getElementById('keysHint');
  if (hintText) {
    hintText.innerHTML = '<div class="keys-row"><div class="key">← →</div><div class="key-desc">move</div></div>' +
      '<div class="keys-row"><div class="key">SPACE/↑</div><div class="key-desc">jump</div></div>' +
      '<div class="keys-row"><div class="key">Z</div><div class="key-desc">fire</div></div>' +
      '<div class="keys-row"><div class="key">SHIFT</div><div class="key-desc">run</div></div>';
  }

  currentDifficultyTuning = window.AdaptiveDifficultyAgent?.getTuning?.(selectedLevel) || {
    enemySpawnMultiplier: 1,
    enemySpeedMultiplier: 1,
    platformGapMultiplier: 1,
    timeBonusSeconds: 0,
    label: 'normal',
  };

  initGame(selectedLevel);
  G.started = true;
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = setInterval(tickTimer, 1000);
  if (RAF) cancelAnimationFrame(RAF);
  gameLoop();
}

// ── Level generation ───────────────────────────────────────
function initGame(level) {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  G = {
    level, coins: 0, score: 0, exp: 0, lives: 3,
    timeLeft: Math.max(20, level.time + (currentDifficultyTuning.timeBonusSeconds || 0)), elapsed: 0,
    started: false, dead: false, won: false,
    inBonus: false, bonusEntryPoint: null, hasFallenBonus: false,
    camera: { x: 0 },
    player: {
      x: 80, y: canvas.height - 120, w: 36, h: 44,
      vx: 0, vy: 0, grounded: false, facing: 1,
      hasFireFlower: false, hasStar: false,
      starTimer: 0, invincible: false, invTimer: 0,
      frame: 0, animTimer: 0, shootTimer: 0, action: 'idle',
    },
    platforms: [], enemies: [], coins_list: [], eggs: [],
    fireballs: [], effects: [], buffs: [],
    eggCollectedThisLife: false,
    pendingEggDrop: null,
    levelWidth: 0, flagX: 0, flagTopY: 0, flagBottomY: 0, castleX: 0,
  };
  generateLevel();
}

function generateBonusLevel() {
  G.normalPlatforms = G.platforms;
  G.normalEnemies = G.enemies;
  G.normalCoins = G.coins_list;
  G.normalEggs = G.eggs;

  G.platforms = [];
  G.enemies = [];
  G.coins_list = [];
  G.eggs = [];
  G.hasFallenBonus = false;

  const levelDiff = G.level.diff;
  const bonusValues = levelDiff === 'easy' ? [10, 20, 35, 60, 100] :
                      levelDiff === 'med' ? [15, 30, 50, 75, 100] :
                      levelDiff === 'hard' ? [20, 40, 60, 85, 100] :
                      [25, 45, 70, 100, 100];

  const W = canvas.width * 2.5;

  let x = 0;

  G.platforms.push({ x: 0, y: canvas.height - 120, w: 200, h: TILE, type: 'platform' });
  G.coins_list.push({ x: 80, y: canvas.height - 180, w: 16, h: 16, collected: false, value: bonusValues[0] });
  x = 200;

  x += 60;
  G.platforms.push({ x, y: canvas.height - 120, w: 80, h: TILE, type: 'platform' });
  G.coins_list.push({ x: x + 30, y: canvas.height - 180, w: 16, h: 16, collected: false, value: bonusValues[1] });
  x += 80;

  x += 100;
  G.platforms.push({ x, y: canvas.height - 120, w: 60, h: TILE, type: 'platform' });
  G.coins_list.push({ x: x + 20, y: canvas.height - 180, w: 16, h: 16, collected: false, value: bonusValues[2] });
  x += 60;

  x += 80;
  G.platforms.push({ x, y: canvas.height - 120, w: 40, h: TILE, type: 'platform' });
  G.coins_list.push({ x: x + 12, y: canvas.height - 180, w: 16, h: 16, collected: false, value: bonusValues[3] });
  x += 40;

  x += 120;
  G.platforms.push({ x, y: canvas.height - 120, w: 150, h: TILE, type: 'platform' });
  for (let c = 0; c < 5; c++) {
    G.coins_list.push({ x: x + 20 + c * 25, y: canvas.height - 180, w: 16, h: 16, collected: false, value: bonusValues[4] });
  }

  x += 200;
  G.platforms.push({ x, y: canvas.height - 120, w: 52, h: TILE * 2 + 20, type: 'pipe', secret: false, isExit: true });
}

function generateLevel() {
  const lv = G.level;
  const W = Math.max(canvas.width * 4, 3200);
  G.levelWidth = W;
  G.flagX = W - 240;
  G.flagBottomY = canvas.height - TILE;
  G.flagTopY = canvas.height - TILE * 10;
  G.castleX = G.flagX + 110;

  for (let x = 0; x < W; x += TILE) {
    G.platforms.push({ x, y: canvas.height - TILE, w: TILE, h: TILE, type: 'ground' });
    G.platforms.push({ x, y: canvas.height - TILE * 2 + 4, w: TILE, h: 4, type: 'grass' });
  }

  const tunedGap = Math.max(80, Math.round(lv.platformGap * (currentDifficultyTuning.platformGapMultiplier || 1)));
  const enemySpawnFactor = Math.max(0.2, currentDifficultyTuning.enemySpawnMultiplier || 1);
  let lastX = 400;
  const numPlats = Math.floor(W / (tunedGap + 80));
  for (let i = 0; i < numPlats; i++) {
    const x = lastX + tunedGap + Math.random() * 60;
    const y = canvas.height - (120 + Math.random() * (canvas.height * 0.35));
    const w = (3 + Math.floor(Math.random() * 4)) * TILE;
    G.platforms.push({ x, y, w, h: TILE, type: 'platform' });

    if (Math.random() < 0.4 * enemySpawnFactor && lv.enemies.length) {
      const en = lv.enemies[Math.floor(Math.random() * lv.enemies.length)];
      spawnEnemy(en, x + w / 2, y - 50);
    }
    if (Math.random() < lv.coinDensity) {
      for (let c = 0; c < 3 + Math.floor(Math.random() * 4); c++)
        G.coins_list.push({ x: x + 20 + c * 30, y: y - 50, w: 16, h: 16, collected: false });
    }
    if (Math.random() < 0.18 && lv.buffs.length) {
      const bf = lv.buffs[Math.floor(Math.random() * lv.buffs.length)];
      G.buffs.push({ x: x + w / 2, y: y - 60, type: bf, collected: false, bob: 0 });
    }
    lastX = x + w;
  }

  for (let x = 400; x < W - 400; x += tunedGap * 0.8 + Math.random() * 80) {
    if (Math.random() < 0.5 * enemySpawnFactor && lv.enemies.length) {
      const en = lv.enemies[Math.floor(Math.random() * lv.enemies.length)];
      spawnEnemy(en, x, canvas.height - TILE * 2 - 50);
    }
  }

  for (let x = 200; x < W - 200; x += 80 + Math.random() * 60) {
    if (Math.random() < lv.coinDensity * 0.7)
      G.coins_list.push({ x, y: canvas.height - TILE * 2 - 60, w: 16, h: 16, collected: false });
  }

  if (lv.obstacles.includes('lava')) {
    for (let x = 800; x < W - 600; x += 600 + Math.random() * 300) {
      const pw = 120 + Math.random() * 80;
      G.platforms.push({ x, y: canvas.height - TILE + 10, w: pw, h: TILE * 2, type: 'lava' });
    }
  }

  if (lv.obstacles.includes('pipe')) {
    for (let x = 350; x < W - 300; x += 300 + Math.random() * 200) {
      const isSecret = Math.random() < 0.25;
      G.platforms.push({ x, y: canvas.height - TILE * 2 - 20, w: 52, h: TILE * 2 + 20, type: 'pipe', secret: isSecret });
    }
  }

  spawnSingleLifeEgg();
}

function spawnSingleLifeEgg() {
  const groundY = canvas.height - TILE;
  const maxJumpHeight = TILE * 4.5;

  const spots = G.platforms
    .filter(pl => (pl.type === 'platform' || pl.type === 'ground') && pl.w >= TILE * 2)
    .filter(pl => pl.x > 160 && pl.x < G.levelWidth - 220)
    .filter(pl => {
      if (pl.type === 'ground') return true;
      // Keep egg platforms within a reachable jump band above the running path.
      const heightAboveGround = groundY - pl.y;
      return heightAboveGround >= TILE * 0.5 && heightAboveGround <= maxJumpHeight;
    });

  if (!spots.length) {
    const fallbackGround = G.platforms
      .filter(pl => pl.type === 'ground' && pl.w >= TILE)
      .filter(pl => pl.x > 160 && pl.x < G.levelWidth - 220);
    if (!fallbackGround.length) {
      G.eggs = [];
      return;
    }
    const base = fallbackGround[Math.floor(Math.random() * fallbackGround.length)];
    const x = base.x + 10 + Math.random() * Math.max(10, base.w - 20);
    G.eggs = [{ x, y: base.y - 28, w: 16, h: 20, collected: false, bob: Math.random() * Math.PI * 2 }];
    return;
  }

  const base = spots[Math.floor(Math.random() * spots.length)];
  const x = base.x + 10 + Math.random() * Math.max(10, base.w - 20);
  const yOffset = 26 + Math.random() * 42;
  const y = Math.max(60, base.y - yOffset);

  G.eggs = [{ x, y, w: 16, h: 20, collected: false, bob: Math.random() * Math.PI * 2 }];
}

function spawnEnemy(type, x, y) {
  const speedScale = Math.max(0.65, currentDifficultyTuning.enemySpeedMultiplier || 1);
  G.enemies.push({
    x, y, w: 36, h: 36, type,
    vx: -(G.level.enemySpeed * speedScale * (0.7 + Math.random() * 0.6)),
    vy: 0, alive: true, grounded: false,
    frame: 0, animTimer: 0, bounceTimer: 0,
    special: type === 'thwomp' ? { state: 'up', timer: 0 } : null,
  });
}

// ── Timer ──────────────────────────────────────────────────
function tickTimer() {
  if (!G.started || G.dead || G.won) return;
  G.timeLeft--;
  G.elapsed++;
  if (G.timeLeft <= 0) playerDie();
}

// ── Fireball ───────────────────────────────────────────────
function shootFireball() {
  if (G.player) G.player.shootTimer = 10;
  G.fireballs.push({
    x: G.player.x + (G.player.facing > 0 ? G.player.w : 0),
    y: G.player.y + 20, w: 12, h: 12,
    vx: 12 * G.player.facing, vy: -4,
    alive: true, bounces: 0,
  });
}

// ── Main loop ──────────────────────────────────────────────
function gameLoop() {
  if (G.started) { update(); render(); }
  RAF = requestAnimationFrame(gameLoop);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Update ─────────────────────────────────────────────────
function update() {
  if (G.dead || G.won) return;
  const p = G.player;

  p.animTimer = (p.animTimer || 0) + 1;
  if (p.shootTimer > 0) p.shootTimer--;

  const running = pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight');
  const spd = running ? RUN_SPEED : MOVE_SPEED;
  if (pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA')) { p.vx = -spd; p.facing = -1; }
  else if (pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD')) { p.vx = spd; p.facing = 1; }
  else p.vx *= 0.75;

  if ((pressedKeys.has('Space') || pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW')) && p.grounded) {
    p.vy = JUMP_FORCE - (running ? 1.5 : 0);
    p.grounded = false;
  }

  if (!p.grounded) p.action = 'jump';
  else if (Math.abs(p.vx) > 0.7) p.action = 'run';
  else p.action = 'idle';
  if (p.shootTimer > 0) p.action = 'shoot';
  p.frame = p.action === 'run' ? Math.floor(p.animTimer / 6) % 2 : 0;

  p.vy += GRAVITY;
  if (p.vy > 18) p.vy = 18;
  p.x += p.vx;
  p.y += p.vy;
  p.grounded = false;

  for (const pl of G.platforms) {
    if (pl.type === 'lava' || pl.type === 'spike') { 
      if (rectsOverlap(p, pl)) { 
        if (G.inBonus) {
          if (!G.hasFallenBonus) {
            G.hasFallenBonus = true;
            spawnEffect(p.x, p.y, '💫 OOPS!', '#FF6600');
            p.y = canvas.height + 51;
          }
        } else {
          playerDie(); 
        }
        return; 
      }
      continue; 
    }
    
    if (pl.type === 'pipe' && pl.isExit) { continue; }
    
    if (pl.type === 'pipe') {
      if (rectsOverlap(p, pl) && p.vy >= 0 && p.y + p.h - p.vy <= pl.y + 10) {
        p.y = pl.y - p.h; p.vy = 0; p.grounded = true;
      } else if (rectsOverlap(p, pl) && p.vx !== 0) {
        if (p.vx > 0) p.x = pl.x - p.w;
        else p.x = pl.x + pl.w;
      }
    } else {
      if (rectsOverlap(p, pl) && p.vy >= 0 && p.y + p.h - p.vy <= pl.y + 2) {
        p.y = pl.y - p.h; p.vy = 0; p.grounded = true;
      }
    }
  }
  
  if (G.player.grounded && pressedKeys.has('ArrowDown')) {
    for (const pl of G.platforms) {
      if (pl.type === 'pipe' && pl.secret && !pl.isExit && rectsOverlap(p, pl)) {
        if (!G.inBonus) {
          G.inBonus = true;
          G.hasFallenBonus = false;
          G.bonusEntryPoint = { x: p.x, y: p.y };
          generateBonusLevel();
          p.x = 80; p.y = canvas.height - 120;
          p.vx = 0; p.vy = 0;
          G.camera.x = 0;
          spawnEffect(p.x, p.y, '✨ BONUS!', '#FFD700');
        }
        break;
      }
    }
  }

  if (p.x < 0) p.x = 0;
  if (p.y > canvas.height + 50) { 
    if (G.inBonus) {
      G.inBonus = false;
      G.platforms = G.normalPlatforms;
      G.enemies = G.normalEnemies;
      G.coins_list = G.normalCoins;
      p.x = G.bonusEntryPoint.x;
      p.y = G.bonusEntryPoint.y;
      G.camera.x = 0;
      spawnEffect(p.x, p.y, '🏁 EXIT!', '#FF6600');
    } else {
      playerDie();
    }
    return; 
  }

  G.camera.x = Math.max(0, Math.min(p.x - canvas.width * 0.35, G.levelWidth - canvas.width));

  for (const en of G.enemies) {
    if (!en.alive) continue;
    if (en.type === 'thwomp') { updateThwomp(en); continue; }

    if (en.type !== 'bullet') {
      en.vy += GRAVITY;
      if (en.vy > 15) en.vy = 15;
    } else { en.vx = -6; en.vy = 0; }

    const prevX = en.x;
    en.x += en.vx; en.y += en.vy;
    en.grounded = false;

    // Enemies should not pass through solid obstacles such as pipes/platform edges.
    for (const pl of G.platforms) {
      if (!['ground', 'platform', 'pipe'].includes(pl.type)) continue;
      if (!rectsOverlap(en, pl)) continue;
      if (en.vx > 0 && prevX + en.w <= pl.x + 4) {
        en.x = pl.x - en.w;
        en.vx = -Math.abs(en.vx);
        en.bounceTimer = 20;
      } else if (en.vx < 0 && prevX >= pl.x + pl.w - 4) {
        en.x = pl.x + pl.w;
        en.vx = Math.abs(en.vx);
        en.bounceTimer = 20;
      }
    }

    for (const pl of G.platforms) {
      if (pl.type === 'lava') continue;
      if (rectsOverlap(en, pl) && en.vy >= 0 && en.y + en.h - en.vy <= pl.y + 2) {
        en.y = pl.y - en.h; en.vy = 0; en.grounded = true;
      }
    }

    en.bounceTimer--;
    if (en.grounded && en.bounceTimer <= 0) {
      const front = { x: en.x + (en.vx > 0 ? en.w : 0), y: en.y + en.h + 2, w: 2, h: 2 };
      let edge = true;
      for (const pl of G.platforms) { if (pl.type !== 'lava' && rectsOverlap(front, pl)) { edge = false; break; } }
      if (edge) { en.vx *= -1; en.bounceTimer = 20; }
    }

    if (en.type === 'paratroopa' && en.grounded) { en.vy = -9; en.vx *= -1; }
    if (en.y > canvas.height + 100) en.alive = false;

    if (rectsOverlap(p, en)) {
      if (p.vy > 0 && p.y + p.h < en.y + en.h * 0.6) {
        en.alive = false; p.vy = -8; addScore(200); G.exp += 20;
        spawnEffect(en.x, en.y, 'STOMP! +200', COLORS.coin);
      } else if (!p.hasStar && !p.invincible) { playerDie(); return; }
    }
  }

  for (const fb of G.fireballs) {
    if (!fb.alive) continue;
    fb.vy += GRAVITY * 0.5; fb.x += fb.vx; fb.y += fb.vy;
    for (const pl of G.platforms) {
      if (pl.type !== 'lava' && rectsOverlap(fb, pl)) { fb.vy = -fb.vy * 0.6; fb.bounces++; if (fb.bounces > 3) fb.alive = false; }
    }
    for (const en of G.enemies) {
      if (en.alive && rectsOverlap(fb, en)) { en.alive = false; fb.alive = false; addScore(300); G.exp += 30; }
    }
    if (fb.x < G.camera.x - 50 || fb.x > G.camera.x + canvas.width + 50) fb.alive = false;
  }

  for (const c of G.coins_list) {
    if (!c.collected && rectsOverlap(p, c)) {
      c.collected = true; 
      const coinValue = c.value || 10;
      G.coins += coinValue; 
      addScore(coinValue * 5); 
      if (G.inBonus) G.exp += coinValue;
      else G.exp += Math.round(coinValue / 2);
      spawnEffect(c.x, c.y, '+' + coinValue, COLORS.coin);
    }
  }

  for (const egg of G.eggs) {
    if (egg.collected) continue;
    if (G.eggCollectedThisLife) continue;
    egg.bob += 0.05;
    const er = { x: egg.x - 10, y: egg.y - 10 + Math.sin(egg.bob) * 3, w: 20, h: 24 };
    if (rectsOverlap(p, er)) {
      G.eggCollectedThisLife = true;
      egg.collected = true;
      const drop = mintEggMaterial(G.level, selectedLevel.bet || G.level.bet || 5);
      G.pendingEggDrop = drop;
      const isSuper = drop.rarity === 'rarest';
      addScore(isSuper ? 4000 : 500);
      G.exp += isSuper ? 180 : 35;
      spawnEffect(
        egg.x,
        egg.y,
        isSuper ? '🥚 SUPER RARE SECURED - BAGGED ON LEVEL CLEAR' : '🥚 COMMON SECURED - BAGGED ON LEVEL CLEAR',
        isSuper ? '#FF3366' : '#FFD700'
      );
    }
  }

  for (const bf of G.buffs) {
    if (!bf.collected) {
      bf.bob += 0.08;
      const br = { x: bf.x - 15, y: bf.y - 15 + Math.sin(bf.bob) * 5, w: 30, h: 30 };
      if (rectsOverlap(p, br)) { bf.collected = true; applyBuff(bf.type); }
    }
  }

  G.effects = G.effects.filter(e => { e.life--; e.y -= 0.8; return e.life > 0; });

  if (p.hasStar) { p.starTimer--; if (p.starTimer <= 0) p.hasStar = false; }
  if (p.invincible) { p.invTimer--; if (p.invTimer <= 0) p.invincible = false; }

  if (G.inBonus) {
    for (const pl of G.platforms) {
      if (pl.type === 'pipe' && pl.isExit && rectsOverlap(p, pl)) {
        G.inBonus = false;
        G.hasFallenBonus = false;
        G.platforms = G.normalPlatforms;
        G.enemies = G.normalEnemies;
        G.coins_list = G.normalCoins;
        G.eggs = G.normalEggs || [];
        p.x = G.bonusEntryPoint.x;
        p.y = G.bonusEntryPoint.y;
        G.camera.x = 0;
        spawnEffect(p.x, p.y, '🎁 BONUS COMPLETE!', '#00FF44');
        const expBonus = G.level.diff === 'easy' ? 10 : G.level.diff === 'med' ? 25 : G.level.diff === 'hard' ? 50 : 100;
        G.exp += expBonus;
        addScore(expBonus * 10);
        return;
      }
    }
    if (p.y > canvas.height + 50) {
      G.inBonus = false;
      G.platforms = G.normalPlatforms;
      G.enemies = G.normalEnemies;
      G.coins_list = G.normalCoins;
      G.eggs = G.normalEggs || [];
      p.x = G.bonusEntryPoint.x;
      p.y = G.bonusEntryPoint.y;
      G.camera.x = 0;
      spawnEffect(p.x, p.y, 'OOPS! Back to main level', '#FF6600');
      addScore(100);
    }
  }
  
  if (!G.inBonus) {
    const poleRect = {
      x: G.flagX - 6,
      y: G.flagTopY,
      w: 12,
      h: G.flagBottomY - G.flagTopY,
    };
    if (rectsOverlap(p, poleRect)) {
      const clampedY = Math.max(G.flagTopY, Math.min(G.flagBottomY, p.y + p.h * 0.5));
      const ratioFromTop = (clampedY - G.flagTopY) / Math.max(1, (G.flagBottomY - G.flagTopY));
      const flagExp = Math.round(1000 - ratioFromTop * 900); // top=1000, bottom=100
      G.exp += flagExp;
      addScore(flagExp * 2);
      spawnEffect(G.flagX, clampedY, `FLAG +${flagExp} EXP`, '#FFD700');
      winLevel();
      return;
    }
  }

  document.getElementById('hudCoins').textContent = String(G.coins).padStart(3, '0');
  document.getElementById('hudExp').textContent = G.exp;
  document.getElementById('hudScore').textContent = String(G.score).padStart(6, '0');
  document.getElementById('hudTime').textContent = String(G.timeLeft).padStart(3, '0');
  document.getElementById('hudLives').textContent = '♥'.repeat(Math.max(0, G.lives));
  document.getElementById('pbFill').style.width = (G.timeLeft / G.level.time * 100) + '%';
  
  const hudLevel = document.getElementById('hudLevel');
  if (G.inBonus) {
    hudLevel.textContent = '⭐BONUS⭐';
    hudLevel.style.color = '#FFD700';
  } else {
    hudLevel.textContent = '1';
    hudLevel.style.color = '#FFFFFF';
  }
}

function updateThwomp(en) {
  const p = G.player;
  if (en.special.state === 'up') {
    if (Math.abs(p.x - en.x) < 60) en.special.state = 'fall';
  } else if (en.special.state === 'fall') {
    en.y += 8;
    for (const pl of G.platforms) {
      if (rectsOverlap(en, pl)) { en.special.state = 'wait'; en.special.timer = 60; break; }
    }
    if (rectsOverlap(p, en) && !p.hasStar) { playerDie(); }
  } else {
    en.special.timer--;
    if (en.special.timer <= 0) en.special.state = 'up';
  }
}

function applyBuff(type) {
  const p = G.player;
  if (type === 'mushroom') { addScore(1000); spawnEffect(p.x, p.y, 'BOOST! +EXP', COLORS.coin); G.exp += 50; }
  else if (type === 'fire') { p.hasFireFlower = true; addScore(1000); spawnEffect(p.x, p.y, 'FIRE FLOWER!', '#FF6600'); }
  else if (type === 'star') { p.hasStar = true; p.starTimer = 300; addScore(2000); spawnEffect(p.x, p.y, '★ STAR!', COLORS.coin); }
  else if (type === '1up') { addScore(1200); spawnEffect(p.x, p.y, 'SHIELD XP!', '#00FF44'); G.exp += 60; }
}

function addScore(n) { G.score += n; }
function spawnEffect(x, y, txt, col) { G.effects.push({ x, y, txt, col, life: 60 }); }

function playerDie() {
  G.lives--;
  window.AdaptiveDifficultyAgent?.recordDeath?.(G.level?.id || selectedLevel?.id || 1);
  G.player.invincible = true; G.player.invTimer = 120;
  if (G.lives < 0) G.lives = 0;
  if (G.lives <= 0) { gameOver(); return; }
  G.player.x = 80; G.player.y = canvas.height - 120;
  G.player.vx = 0; G.player.vy = 0; G.camera.x = 0;
}

function winLevel() {
  if (G.won) return;
  G.won = true; G.started = false;
  clearInterval(gameTimer);
  const expGained = G.exp + G.coins * 5 + G.timeLeft * 2;
  const mins = Math.floor(G.elapsed / 60);
  const secs = String(G.elapsed % 60).padStart(2, '0');
  document.getElementById('ovTitle').textContent = '🎉 LEVEL CLEAR!';
  document.getElementById('ovTitle').style.color = 'var(--green)';
  document.getElementById('ovScore').textContent = `COINS: ${G.coins} | EXP: ${expGained} | SCORE: ${G.score}`;
  document.getElementById('ovTime').textContent = `TIME: ${mins}:${secs} — SUBMITTING TO HEDERA ORACLE`;
  document.getElementById('gameOverlay').style.display = 'flex';
  window._lastResult = {
    level: G.level.id,
    time: G.elapsed,
    exp: expGained,
    coins: G.coins,
    score: G.score,
    challengeType: selectedChallengeType,
    sessionId: selectedSessionId,
    challengeId: selectedChallengeId
  };

  if (G.pendingEggDrop && window.BlockchainBridge?.collectEggToBag) {
    window.BlockchainBridge.collectEggToBag(G.pendingEggDrop, G.level.id)
      .then(result => {
        if (result && result.full) {
          alert(`EggCollector bag for this level is full (${result.localCount}/${result.bagLimit}).`);
        }
        return syncEggCollectorBag();
      })
      .catch(err => console.warn('Failed to bag egg after level clear:', err));
  }

  window.AdaptiveDifficultyAgent?.recordLevelClear?.(G.level, {
    remainingLives: G.lives,
    timeLeft: G.timeLeft,
    totalTime: G.level.time,
  });
  
  displayMatchResults();
}

function gameOver() {
  G.dead = true; G.started = false;
  clearInterval(gameTimer);
  document.getElementById('ovTitle').textContent = 'GAME OVER';
  document.getElementById('ovTitle').style.color = 'var(--red)';
  document.getElementById('ovScore').textContent = `COINS: ${G.coins} | EXP: ${G.exp}`;
  document.getElementById('ovTime').textContent = 'BET FORFEITED TO PRIZE POOL';
  document.getElementById('gameOverlay').style.display = 'flex';
}

async function displayMatchResults() {
  const instantSb = document.getElementById('instantScoreboard');
  const weeklySb = document.getElementById('weeklyScoreboard');
  const instantList = document.getElementById('instantScores');
  const weeklyList = document.getElementById('weeklyScores');
  
  instantSb.classList.add('hidden');
  weeklySb.classList.add('hidden');
  
  if (selectedChallengeType === 'instant') {
    await displayInstantResults(instantSb, instantList);
  } else if (selectedChallengeType === 'weekly') {
    await displayWeeklyResults(weeklySb, weeklyList);
  }
}

async function displayInstantResults(container, listEl) {
  try {
    const results = await fetchInstantMatchResults() || createDummyInstantResults();
    
    if (!results || !Array.isArray(results)) {
      container.classList.add('hidden');
      return;
    }
    
    const totalPool = results.reduce((sum, e) => sum + (e.bet || 0), 0);
    const winnerPayout = totalPool * 0.95;
    
    listEl.innerHTML = results.map((entry, idx) => {
      const isWinner = idx === 0;
      const displayTime = formatTime(entry.time);
      const playerAddr = entry.player ? `${entry.player.slice(0, 8)}...${entry.player.slice(-4)}` : 'Player ' + (idx + 1);
      const bet = entry.bet || 0;
      const winnings = isWinner ? winnerPayout : 0;
      return `
        <div class="score-row ${isWinner ? 'winner' : ''}">
          <div class="score-rank rank-${idx + 1}">${idx + 1}</div>
          <div class="score-player">${playerAddr}</div>
          <div class="score-time">${displayTime}</div>
          <div class="score-bet">⬡${bet.toFixed(1)}</div>
          <div class="score-winnings">${isWinner ? '⬡' + winnings.toFixed(1) : '−'}</div>
        </div>
      `;
    }).join('');
    
    container.classList.remove('hidden');
  } catch (err) {
    console.warn('Failed to load instant results:', err);
    container.classList.add('hidden');
  }
}

async function displayWeeklyResults(container, listEl) {
  try {
    const leaderboard = await fetchWeeklyLeaderboard() || createDummyWeeklyLeaderboard();
    
    if (!leaderboard || !Array.isArray(leaderboard)) {
      container.classList.add('hidden');
      return;
    }
    
    listEl.innerHTML = leaderboard.slice(0, 10).map((entry, idx) => {
      const isWinner = idx === 0;
      const playerAddr = entry.player ? `${entry.player.slice(0, 8)}...${entry.player.slice(-4)}` : 'Player ' + (idx + 1);
      const displayTime = formatTime(entry.time || entry.bestTime || 0);
      const winnings = entry.winnings || (isWinner ? entry.poolPayout || 0 : 0);
      return `
        <div class="score-row ${isWinner ? 'winner' : ''}">
          <div class="score-rank rank-${idx + 1}">${idx + 1}</div>
          <div class="score-player">${playerAddr}</div>
          <div class="score-time">${displayTime}</div>
          <div class="score-winnings">${isWinner ? '⬡' + winnings.toFixed(1) : '−'}</div>
        </div>
      `;
    }).join('');
    
    container.classList.remove('hidden');
  } catch (err) {
    console.warn('Failed to load weekly results:', err);
    container.classList.add('hidden');
  }
}

async function fetchInstantMatchResults() {
  if (window.BlockchainBridge?.getInstantMatchResults && selectedChallengeId) {
    try {
      return await window.BlockchainBridge.getInstantMatchResults(selectedChallengeId);
    } catch (e) {
      console.warn('Blockchain fetch failed, using dummy:', e);
    }
  }
  return null;
}

async function fetchWeeklyLeaderboard() {
  if (window.BlockchainBridge?.getWeeklyLeaderboard && selectedLevel?.id) {
    try {
      return await window.BlockchainBridge.getWeeklyLeaderboard(selectedLevel.id);
    } catch (e) {
      console.warn('Blockchain fetch failed, using dummy:', e);
    }
  }
  return null;
}

function createDummyInstantResults() {
  const bet = parseFloat(document.getElementById('betAmount').value) || selectedLevel.bet;
  const times = [G.elapsed, G.elapsed + 5 + Math.random() * 15, G.elapsed + 10 + Math.random() * 20];
  times.sort((a, b) => a - b);
  return times.map((t, i) => ({
    player: `0x${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
    time: t,
    bet: bet,
    rank: i + 1
  }));
}

function createDummyWeeklyLeaderboard() {
  const weeklyPool = 250;
  const winnerPayout = weeklyPool * 0.95;
  return Array.from({ length: 5 }, (_, i) => ({
    player: `0x${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`,
    time: 45 + Math.random() * 30,
    points: (5 - i) * 100,
    poolPayout: i === 0 ? winnerPayout : 0,
    winnings: i === 0 ? winnerPayout : 0
  }));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mins}:${secs}`;
}

function backToLevels() {
  document.getElementById('gameOverlay').style.display = 'none';
  document.getElementById('instantScoreboard').classList.add('hidden');
  document.getElementById('weeklyScoreboard').classList.add('hidden');
  document.getElementById('gameCanvas').style.display = 'none';
  document.getElementById('gameHud').style.display = 'none';
  document.getElementById('keysHint').style.display = 'none';
  document.getElementById('powerBar').style.display = 'none';
  document.getElementById('levelSelect').style.display = 'flex';
  const hintText = document.getElementById('keysHint');
  if (hintText) {
    hintText.innerHTML = '<div class="keys-row"><div class="key">← →</div><div class="key-desc">move</div></div>' +
      '<div class="keys-row"><div class="key">SPACE/↑</div><div class="key-desc">jump</div></div>' +
      '<div class="keys-row"><div class="key">Z</div><div class="key-desc">fire</div></div>' +
      '<div class="keys-row"><div class="key">SHIFT</div><div class="key-desc">run</div></div>';
  }
  if (RAF) cancelAnimationFrame(RAF);
  clearInterval(gameTimer);
}

function retryLevel() {
  document.getElementById('gameOverlay').style.display = 'none';
  const hintText = document.getElementById('keysHint');
  if (hintText) {
    hintText.innerHTML = '<div class="keys-row"><div class="key">← →</div><div class="key-desc">move</div></div>' +
      '<div class="keys-row"><div class="key">SPACE/↑</div><div class="key-desc">jump</div></div>' +
      '<div class="keys-row"><div class="key">Z</div><div class="key-desc">fire</div></div>' +
      '<div class="keys-row"><div class="key">SHIFT</div><div class="key-desc">run</div></div>';
  }
  initGame(selectedLevel);
  G.started = true;
  clearInterval(gameTimer);
  gameTimer = setInterval(tickTimer, 1000);
}

async function submitScore() {
  if (!window._lastResult) return;
  if (window._lastResult?.challengeType === 'instant' && isDummyInstantSession(window._lastResult?.sessionId, window._lastResult?.challengeId)) {
    document.getElementById('ovTitle').textContent = '✓ DUMMY INSTANT RUN COMPLETE';
    document.getElementById('ovTitle').style.color = 'var(--green)';
    document.getElementById('ovTime').textContent = 'Local test room: score was not submitted on-chain.';
    return;
  }
  if (window._lastResult?.challengeType !== 'normal' && !isOnchainSessionId(window._lastResult?.sessionId)) {
    document.getElementById('ovTitle').textContent = '✗ Invalid challenge session';
    document.getElementById('ovTitle').style.color = 'var(--red)';
    return;
  }
  document.getElementById('ovTitle').textContent = '⛓ VERIFYING AND SUBMITTING...';
  document.getElementById('ovTitle').style.color = 'var(--cyan)';

  try {
    if (window.BlockchainBridge?.verifyAndSubmitScore) {
      await window.BlockchainBridge.verifyAndSubmitScore(window._lastResult);
    } else {
      await window.BlockchainBridge?.submitScore(window._lastResult);
    }
    document.getElementById('ovTitle').textContent = '✓ SCORE ON-CHAIN!';
    document.getElementById('ovTitle').style.color = 'var(--green)';
  } catch (e) {
    document.getElementById('ovTitle').textContent = '✗ ' + (e.message || 'Error');
    document.getElementById('ovTitle').style.color = 'var(--red)';
  }
}

// ── Renderer ───────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = G.camera.x;
  const terrainPalette = getTerrainPalette(G.level?.diff || selectedLevel?.diff || 'easy');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (G.inBonus) {
    grad.addColorStop(0, '#001529'); grad.addColorStop(1, '#081a44');
  } else {
    grad.addColorStop(0, '#050518'); grad.addColorStop(1, '#1a0a3a');
  }
  ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 80; i++) {
    ctx.fillRect((i * 137 + cx * 0.04) % canvas.width, (i * 73) % (canvas.height * 0.6), 1.5, 1.5);
  }

  for (const pl of G.platforms) {
    const sx = pl.x - cx;
    if (sx + pl.w < 0 || sx > canvas.width) continue;
    if (pl.type === 'ground') {
      ctx.fillStyle = terrainPalette.ground; ctx.fillRect(sx, pl.y, pl.w, pl.h);
    } else if (pl.type === 'grass') {
      ctx.fillStyle = '#22aa44'; ctx.fillRect(sx, pl.y, pl.w, pl.h);
    } else if (pl.type === 'platform') {
      ctx.fillStyle = terrainPalette.platformBody; ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = terrainPalette.platformTop; ctx.fillRect(sx, pl.y, pl.w, 6);
      ctx.fillStyle = terrainPalette.platformStripe;
      for (let bx = 0; bx < pl.w; bx += 20) ctx.fillRect(sx + bx, pl.y + 6, 1, pl.h - 6);
      ctx.fillRect(sx, pl.y + pl.h / 2, pl.w, 1);
    } else if (pl.type === 'pipe' && pl.isExit) {
      ctx.fillStyle = '#3ECF5E';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#8BFFB3';
      ctx.fillRect(sx - 4, pl.y, pl.w + 8, 20);
      ctx.fillStyle = '#1B8F3A';
      ctx.fillRect(sx + pl.w - 4, pl.y, 4, pl.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(sx + 6, pl.y + 8, 8, pl.h - 14);
      ctx.fillStyle = '#FFD84D';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', sx + pl.w / 2, pl.y - 10);
    } else if (pl.type === 'pipe') {
      ctx.fillStyle = pl.secret ? '#32C7FF' : '#45D46B';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = pl.secret ? '#93E6FF' : '#A7FFC1';
      ctx.fillRect(sx - 4, pl.y, pl.w + 8, 20);
      ctx.fillStyle = pl.secret ? '#1486B0' : '#1E8D42';
      ctx.fillRect(sx + pl.w - 4, pl.y, 4, pl.h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(sx + 6, pl.y + 8, 8, pl.h - 14);
    } else if (pl.type === 'lava') {
      ctx.fillStyle = '#cc1100'; ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#ff4400';
      for (let lx = 0; lx < pl.w; lx += 20) {
        const h = 8 + Math.sin((lx + Date.now() * 0.005) * 0.8) * 6;
        ctx.fillRect(sx + lx, pl.y - h, 12, h + 2);
      }
    } else if (pl.type === 'spike') {
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.moveTo(sx, pl.y + pl.h);
      ctx.lineTo(sx + pl.w / 2, pl.y);
      ctx.lineTo(sx + pl.w, pl.y + pl.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  const fx = G.flagX - cx;
  if (fx > -20 && fx < canvas.width + 20) {
    ctx.fillStyle = '#888'; ctx.fillRect(fx, G.flagTopY, 4, G.flagBottomY - G.flagTopY);
    ctx.fillStyle = '#00ff44';
    ctx.beginPath();
    ctx.moveTo(fx + 4, G.flagTopY + 4);
    ctx.lineTo(fx + 44, G.flagTopY + 14);
    ctx.lineTo(fx + 4, G.flagTopY + 24);
    ctx.fill();
  }

  const castleX = G.castleX - cx;
  if (castleX > -120 && castleX < canvas.width + 120) {
    const baseY = canvas.height - TILE * 4;
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(castleX, baseY, 90, TILE * 3);
    ctx.fillStyle = '#80808a';
    ctx.fillRect(castleX - 6, baseY - 18, 18, 18);
    ctx.fillRect(castleX + 26, baseY - 24, 18, 24);
    ctx.fillRect(castleX + 58, baseY - 18, 18, 18);
    ctx.fillStyle = '#222';
    ctx.fillRect(castleX + 36, baseY + 28, 18, 26);
    ctx.fillStyle = '#9b9ba8';
    for (let bx = 2; bx < 88; bx += 10) {
      ctx.fillRect(castleX + bx, baseY + 6, 6, 4);
    }
  }

  for (const c of G.coins_list) {
    if (c.collected) continue;
    const sx = c.x - cx;
    if (sx < -20 || sx > canvas.width + 20) continue;
    const bob = Math.sin(Date.now() * 0.005 + c.x) * 3;
    ctx.fillStyle = COLORS.coin; ctx.beginPath(); ctx.arc(sx, c.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aa8800'; ctx.beginPath(); ctx.arc(sx, c.y + bob, 4, 0, Math.PI * 2); ctx.fill();
  }

  for (const egg of G.eggs) {
    if (egg.collected) continue;
    const sx = egg.x - cx;
    if (sx < -20 || sx > canvas.width + 20) continue;
    const bob = Math.sin(egg.bob) * 3;

    // High-contrast beacon so egg is immediately visible during runs.
    ctx.fillStyle = 'rgba(255,215,0,0.18)';
    ctx.beginPath();
    ctx.arc(sx, egg.y + bob, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFE680';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, egg.y + bob - 22);
    ctx.lineTo(sx, egg.y + bob - 30);
    ctx.stroke();

    const eggGlow = ctx.createRadialGradient(sx - 2, egg.y + bob - 6, 1, sx, egg.y + bob, 12);
    eggGlow.addColorStop(0, '#FFF6B0');
    eggGlow.addColorStop(0.55, '#F6CA4F');
    eggGlow.addColorStop(1, '#C4871A');
    ctx.fillStyle = eggGlow;
    ctx.beginPath();
    ctx.ellipse(sx, egg.y + bob, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8F5A00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#A96A00';
    ctx.fillRect(sx - 3, egg.y + bob - 2, 2, 2);
    ctx.fillRect(sx + 1, egg.y + bob + 2, 2, 2);
  }

  const buffColors = { mushroom: '#FF4444', fire: '#FF6600', star: '#FFD700', '1up': '#00FF44' };
  const buffLabels = { mushroom: 'M', fire: 'F', star: '★', '1up': '1+' };
  for (const bf of G.buffs) {
    if (bf.collected) continue;
    const sx = bf.x - cx;
    if (sx < -30 || sx > canvas.width + 30) continue;
    const bob = Math.sin(bf.bob) * 5;
    ctx.fillStyle = buffColors[bf.type] || '#FF4444';
    ctx.beginPath(); ctx.arc(sx, bf.y + bob, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText(buffLabels[bf.type] || '?', sx, bf.y + bob + 4);
  }

  for (const en of G.enemies) {
    if (!en.alive) continue;
    const sx = en.x - cx;
    if (sx < -60 || sx > canvas.width + 60) continue;
    drawEnemy(en, sx);
  }

  for (const fb of G.fireballs) {
    if (!fb.alive) continue;
    const sx = fb.x - cx;
    ctx.fillStyle = '#FF6600'; ctx.beginPath(); ctx.arc(sx, fb.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(sx, fb.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  drawPlayer(G.player, cx);

  ctx.textAlign = 'center';
  for (const ef of G.effects) {
    const sx = ef.x - cx;
    ctx.fillStyle = ef.col; ctx.globalAlpha = ef.life / 60;
    ctx.font = 'bold 14px Arial'; ctx.fillText(ef.txt, sx, ef.y); ctx.globalAlpha = 1;
  }
}

function drawEnemy(e, sx) {
  ctx.fillStyle = COLORS[e.type] || '#FF0000';
  if (e.type === 'crawlers') {
    ctx.fillRect(sx, e.y, e.w, e.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(sx + 4, e.y + 4, 6, 6);
    ctx.fillRect(sx + e.w - 10, e.y + 4, 6, 6);
  } else if (e.type === 'koopa') {
    ctx.fillRect(sx, e.y + 8, e.w, e.h - 8);
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + 6, 10, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'bullet') {
    ctx.beginPath(); ctx.arc(sx + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillRect(sx, e.y, e.w, e.h);
  }
}

function drawPlayer(p, cx) {
  const sx = p.x - cx;
  const sy = p.y;

  ctx.fillStyle = '#2D6BFF';
  ctx.fillRect(sx + 14, sy, 8, 8);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(sx + 12, sy + 8, 12, 2);
  
  ctx.fillStyle = '#2D6BFF';
  ctx.fillRect(sx + 10, sy + 10, 16, 16);
  
  ctx.fillStyle = '#72B8FF';
  ctx.fillRect(sx + 12, sy + 14, 6, 12);
  ctx.fillRect(sx + 18, sy + 14, 6, 12);
  
  const armL = p.action === 'run' && p.frame === 0 ? -4 : 0;
  const armR = p.action === 'run' && p.frame === 1 ? 4 : 0;
  
  if (p.action === 'shoot') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx + 26, sy + 12, 8, 4);
    ctx.fillStyle = '#72B8FF';
    ctx.fillRect(sx + 10, sy + 10, 4, 8);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx + 6, sy + 11, 4, 8);
    ctx.fillRect(sx + 26, sy + 11, 4, 8);
  }
  
  ctx.fillStyle = '#3657A8';
  ctx.fillRect(sx + 12, sy + 26, 6, 10);
  ctx.fillRect(sx + 18, sy + 26, 6, 10);
  
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(sx + 11, sy + 36, 8, 4);
  ctx.fillRect(sx + 17, sy + 36, 8, 4);
  
  if (p.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  ctx.globalAlpha = 1;
}
