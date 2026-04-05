// wallet.js — WalletConnect + Blockchain Bridge
// Uses WalletConnect Ethereum Provider (EIP-1193) and ethers.js

let walletConnected = false;
let walletAddress = null;
let provider = null;
let signer = null;
let wcProvider = null;
let wcListenersBound = false;
const STRICT_ONCHAIN_MODE = true;

const WALLETCONNECT_PROJECT_ID_STORAGE_KEY = 'chainrun_walletconnect_project_id';
const SUPER_RUNNER_SUBSCRIPTION_FEE_HBAR = 12;
const SUPER_RUNNER_SUBSCRIPTION_DAYS = 30;
const SUPER_RUNNER_TRIAL_DAYS = 7;
const CHAIN_CONFIG = {
  key: 'evm_testnet',
  chainId: Number(window.CHAIN_ID || 296),
  rpcUrl: String(window.CHAIN_RPC_URL || 'https://testnet.hashio.io/api'),
  chainName: String(window.CHAIN_NAME || 'ChainRun EVM Testnet'),
  nativeDecimals: Number(window.CHAIN_NATIVE_DECIMALS || 8),
};
const ORACLE_API_BASE_URL = String(
  window.CHAINRUN_ORACLE_URL ||
  `${window.location.protocol}//${window.location.hostname || 'localhost'}:3001`
).replace(/\/$/, '');
const WALLETCONNECT_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.22.4/dist/index.umd.js',
  'https://unpkg.com/@walletconnect/ethereum-provider@2.22.4/dist/index.umd.js',
  'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.17.1/dist/index.umd.js',
  'https://unpkg.com/@walletconnect/ethereum-provider@2.17.1/dist/index.umd.js'
];

function getWalletConnectFactory() {
  const scoped = window['@walletconnect/ethereum-provider'];
  return (
    scoped?.default ||
    scoped?.EthereumProvider ||
    window.WalletConnectEthereumProvider?.default ||
    window.WalletConnectEthereumProvider ||
    window.EthereumProvider?.default ||
    window.EthereumProvider ||
    null
  );
}

function looksLikeEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-wc-sdk-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve(true);
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.wcSdkSrc = src;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve(true);
    };
    script.onerror = () => reject(new Error(`Failed loading ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureWalletConnectSdkLoaded() {
  if (getWalletConnectFactory()) return true;

  for (const src of WALLETCONNECT_CDN_URLS) {
    try {
      await loadScriptOnce(src);
      if (getWalletConnectFactory()) return true;
    } catch (err) {
      console.warn('WalletConnect CDN load attempt failed:', src, err);
    }
  }

  return Boolean(getWalletConnectFactory());
}

function getWalletConnectProjectId() {
  const fromWindow = String(window.WALLETCONNECT_PROJECT_ID || '').trim();
  if (fromWindow && !looksLikeEvmAddress(fromWindow)) return fromWindow;

  const fromStorage = String(localStorage.getItem(WALLETCONNECT_PROJECT_ID_STORAGE_KEY) || '').trim();
  if (fromStorage && !looksLikeEvmAddress(fromStorage)) return fromStorage;
  if (fromStorage && looksLikeEvmAddress(fromStorage)) {
    localStorage.removeItem(WALLETCONNECT_PROJECT_ID_STORAGE_KEY);
  }

  const entered = String(prompt('Enter WalletConnect Project ID to connect your wallet:') || '').trim();
  if (looksLikeEvmAddress(entered)) {
    alert('That value looks like a wallet address, not a WalletConnect Project ID. Create a Project ID in WalletConnect Cloud and try again.');
    return '';
  }
  if (entered) {
    localStorage.setItem(WALLETCONNECT_PROJECT_ID_STORAGE_KEY, entered);
    return entered;
  }
  return '';
}
function isBytes32Hex(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));
}

function getReadableWalletError(err) {
  const msg = String(err?.message || err?.reason || err || '').trim();
  if (!msg) return 'Unknown wallet error';
  if (/project id/i.test(msg)) return 'WalletConnect Project ID missing or invalid';
  if (/user rejected|rejected|denied/i.test(msg)) return 'Connection request was rejected in wallet';
  if (/unsupported chain|chain.*not supported/i.test(msg)) return `Connected wallet does not support ${CHAIN_CONFIG.chainName} (chain ${CHAIN_CONFIG.chainId})`;
  if (/insufficient funds|insufficient/i.test(msg)) return 'Insufficient wallet balance for subscription payment + gas';
  if (/failed to fetch|network|rpc/i.test(msg)) return 'Network/RPC error while opening wallet session';
  return msg;
}

function makeWeb3Provider(eip1193Provider) {
  if (!eip1193Provider || typeof ethers === 'undefined') return null;
  if (ethers.providers?.Web3Provider) {
    return new ethers.providers.Web3Provider(eip1193Provider);
  }
  if (ethers.BrowserProvider) {
    return new ethers.BrowserProvider(eip1193Provider);
  }
  return null;
}

function getInjectedProvider() {
  if (typeof window === 'undefined') return null;
  if (window.ethereum?.providers?.length) {
    return window.ethereum.providers.find((candidate) => candidate?.isMetaMask) || window.ethereum.providers[0];
  }
  return window.ethereum || null;
}

async function connectInjectedWallet(btn) {
  const injected = getInjectedProvider();
  if (!injected) return false;

  if (typeof injected.request === 'function') {
    await injected.request({ method: 'eth_requestAccounts' });
  }

  provider = makeWeb3Provider(injected);
  if (!provider) {
    throw new Error('Unable to initialize ethers provider from browser wallet');
  }

  signer = provider.getSigner ? provider.getSigner() : null;
  walletAddress = signer?.getAddress ? await signer.getAddress() : null;

  if (!walletAddress && typeof injected.request === 'function') {
    const accounts = await injected.request({ method: 'eth_accounts' });
    walletAddress = Array.isArray(accounts) ? accounts[0] : null;
  }

  if (!walletAddress) {
    throw new Error('No account returned from browser wallet');
  }

  wcProvider = null;
  walletConnected = true;
  btn.textContent = 'Connected ✓';
  btn.style.borderColor = 'var(--green)';
  btn.style.color = 'var(--green)';
  return true;
}

function bindWalletConnectListeners(btn) {
  if (!wcProvider || wcListenersBound) return;
  wcListenersBound = true;

  wcProvider.on('accountsChanged', (accounts) => {
    const account = Array.isArray(accounts) && accounts[0] ? accounts[0] : null;
    walletAddress = account;
    walletConnected = Boolean(account);
    const addrEl = document.getElementById('walletAddr');
    if (addrEl) {
      addrEl.textContent = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not Connected';
    }
    if (!account && btn) {
      btn.textContent = 'Connect Wallet';
      btn.style.borderColor = 'var(--cyan)';
      btn.style.color = 'var(--cyan)';
      setChainStatus('Chain: Offline', false);
    }
    window.dispatchEvent(new CustomEvent('chainrun:wallet-updated'));
  });

  wcProvider.on('disconnect', () => {
    walletConnected = false;
    walletAddress = null;
    provider = null;
    signer = null;
    const addrEl = document.getElementById('walletAddr');
    if (addrEl) addrEl.textContent = 'Not Connected';
    if (btn) {
      btn.textContent = 'Connect Wallet';
      btn.style.borderColor = 'var(--cyan)';
      btn.style.color = 'var(--cyan)';
    }
    setChainStatus('Chain: Offline', false);
    window.dispatchEvent(new CustomEvent('chainrun:wallet-updated'));
  });
}

// Contract addresses — update after deployment
const CONTRACT_ADDRESSES = {
  evm_testnet: {
    DaveChainGame: '0xb69B0a69EC6AaB40B623F9b0f0e26ec58C8aE15e',
    ExpToken:       '0x0228f6fbA8f6FAeB71AC266527371283DB72FF72',
    DaveAIOracle:  '0x200f91a9e1098A5b1E4aeF78b161AC3DE0e4c2a9',
  }
};
const SUBSCRIPTION_PAYMENT_RECEIVER = String(window.CHAINRUN_SUBSCRIPTION_RECEIVER || '0x4B767A0Ee03A5f2Cf9D1c2f5DbD547e8402f1305');

async function addressHasCode(address) {
  if (!provider || !address) return false;
  try {
    const code = await provider.getCode(address);
    return Boolean(code && code !== '0x');
  } catch (err) {
    console.warn('Failed checking contract code:', err);
    return false;
  }
}

async function getSubscriptionPaymentTarget() {
  const gameAddress = CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame;
  if (await addressHasCode(gameAddress)) {
    return { address: gameAddress, contractAvailable: true };
  }
  return { address: SUBSCRIPTION_PAYMENT_RECEIVER, contractAvailable: false };
}

// Minimal ABI for game interactions
const GAME_ABI = [
  'function startGame(uint256 levelId) external payable returns (bytes32)',
  'function createInstantChallenge(uint256 levelId,uint256 maxPlayers) external payable returns (uint256,bytes32)',
  'function joinInstantChallenge(uint256 challengeId) external payable returns (bytes32)',
  'function joinWeeklyChallenge(uint256 levelId) external payable returns (uint256,bytes32)',
  'function submitCompletion(bytes32 sessionId, uint256 completionTime, uint256 coinsCollected, bytes calldata oracleProof) external',
  'function submitInstantCompletion(bytes32 sessionId, uint256 completionTime, uint256 coinsCollected, bytes calldata oracleProof) external',
  'function submitWeeklyResult(bytes32 sessionId, uint256 completionTime, uint256 coinsCollected, bytes calldata oracleProof) external',
  'function finalizeInstantChallenge(uint256 challengeId) external',
  'function finalizeWeeklyChallenge(uint256 weeklyId) external',
  'function startMaterialIncubation(bytes32 dropHash, uint256 durationSeconds) external returns (uint256)',
  'function startMaterialIncubationWithRarity(bytes32 dropHash, uint256 durationSeconds, uint8 rarityCode) external returns (uint256)',
  'function addEggToCollector(uint256 levelId) external',
  'function incubateEggFromCollector(uint256 levelId, bytes32 dropHash, uint8 rarityCode) external returns (uint256)',
  'function purchaseSuperRunnerSubscription() external payable',
  'function getSubscriptionStatus(address player) external view returns (bool active, uint256 expiresAt, uint256 bagLimit, uint256 maxActiveIncubations)',
  'function getEggCollectorCount(address player, uint256 levelId) external view returns (uint256)',
  'function claimReadyMaterialIncubations(uint256[] calldata incubationIds) external returns (bytes32[] memory)',
  'function executeMaterialTrade(uint8 routeId) external payable',
  'function getMaterialBalance(address player, uint8 rarityCode) external view returns (uint256)',
  'function getMaterialIncubationCount(address player) external view returns (uint256)',
  'function getMaterialIncubation(address player, uint256 incubationId) external view returns (tuple(uint256 id, bytes32 dropHash, uint8 rarityCode, uint256 startAt, uint256 readyAt, uint256 durationSeconds, bool claimed))',
  'function getLevelPool(uint256 levelId) external view returns (uint256)',
  'function getPlayerProfile(address player) external view returns (tuple(uint256 totalExp, uint256 gamesPlayed, uint256 bestTime, uint256 totalWinnings, uint256 rank))',
  'function instantChallengeCounter() external view returns (uint256)',
  'function instantChallenges(uint256 id) external view returns (tuple(uint256 id, uint256 levelId, uint256 betTinybars, uint256 totalPool, uint256 maxPlayers, uint256 createdAt, uint256 playersCount, uint256 completedCount, bool active, bool resolved, address winner, uint256 winningTime, bytes32[] sessionIds))',
  'function activeWeeklyByLevel(uint256 levelId) external view returns (uint256)',
  'function weeklyChallenges(uint256 id) external view returns (tuple(uint256 id, uint256 levelId, uint256 totalPool, uint256 bestTime, address bestPlayer, uint256 startAt, uint256 endAt, bool active, bool paid, bytes32[] sessionIds))',
  'event GameStarted(bytes32 sessionId, address player, uint256 levelId, uint256 bet)',
  'event GameCompleted(bytes32 sessionId, uint256 time, uint256 exp)',
  'event PrizePaid(address winner, uint256 amount, uint256 levelId)',
];

function setChainStatus(text, online = false) {
  const status = document.getElementById('chainStatus');
  if (!status) return;
  status.textContent = text;
  status.style.color = online ? 'var(--green)' : 'var(--cyan)';
}

function isBytes32Hex(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''));
}

async function requestOracleVerification(payload) {
  let response;
  try {
    response = await fetch(`${ORACLE_API_BASE_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    throw new Error(`Oracle agent is unreachable at ${ORACLE_API_BASE_URL}. Start the local agent before submitting scores.`);
  }

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error('Oracle agent returned an unreadable response');
  }

  if (!response.ok || !body?.valid) {
    throw new Error(body?.error || body?.reason || 'Oracle verification failed');
  }

  if (!body?.proof || body.proof === '0x') {
    throw new Error('Oracle agent returned an empty proof');
  }

  return body;
}

async function connectWallet() {
  const btn = document.querySelector('.connect-btn');
  btn.textContent = 'Connecting...';
  try {
    if (typeof ethers === 'undefined') {
      throw new Error('ethers.js failed to load. Please refresh and retry.');
    }

    walletConnected = false;
    walletAddress = null;
    provider = null;
    signer = null;

    const injected = getInjectedProvider();
    if (injected) {
      await connectInjectedWallet(btn);
    } else {
      await ensureWalletConnectSdkLoaded();
      const WalletConnectFactory = getWalletConnectFactory();
      if (!WalletConnectFactory) {
        throw new Error('WalletConnect SDK failed to load from CDN. Check network or firewall and retry.');
      }

      const projectId = getWalletConnectProjectId();
      if (!projectId) {
        throw new Error('WalletConnect Project ID is required when no browser wallet is installed.');
      }

      if (!wcProvider) {
        wcProvider = await WalletConnectFactory.init({
          projectId,
          chains: [CHAIN_CONFIG.chainId],
          optionalChains: [1, 137],
          showQrModal: true,
          metadata: {
            name: 'ChainRun',
            description: 'ChainRun WalletConnect Session',
            url: window.location.origin,
            icons: ['https://walletconnect.com/walletconnect-logo.png']
          },
          rpcMap: {
            [CHAIN_CONFIG.chainId]: CHAIN_CONFIG.rpcUrl
          },
          methods: [
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData',
            'eth_signTypedData_v4'
          ],
          events: ['chainChanged', 'accountsChanged']
        });
      }

      try {
        await wcProvider.enable();
      } catch (enableErr) {
        wcProvider = await WalletConnectFactory.init({
          projectId,
          chains: [CHAIN_CONFIG.chainId],
          optionalChains: [1, 137],
          showQrModal: true,
          rpcMap: { [CHAIN_CONFIG.chainId]: CHAIN_CONFIG.rpcUrl }
        });
        await wcProvider.enable();
      }

      provider = makeWeb3Provider(wcProvider);
      if (!provider) {
        throw new Error('Unable to initialize ethers provider from WalletConnect');
      }

      if (provider.getSigner) {
        signer = provider.getSigner();
        walletAddress = signer.getAddress ? await signer.getAddress() : null;
      }

      if (!walletAddress) {
        const accounts = await wcProvider.request({ method: 'eth_accounts' });
        walletAddress = Array.isArray(accounts) ? accounts[0] : null;
      }

      if (!walletAddress) {
        throw new Error('No account returned from wallet connection');
      }

      walletConnected = true;
      bindWalletConnectListeners(btn);
    }

    document.getElementById('walletAddr').textContent =
      walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    window.BlockchainBridge?.refreshSubscriptionStatus?.().catch((err) => {
      console.warn('Unable to refresh subscription state on connect:', err);
    });
    setChainStatus('Chain: Connected', true);
    window.dispatchEvent(new CustomEvent('chainrun:wallet-updated'));
    btn.textContent = 'Connected ✓';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
  } catch (err) {
    console.error('Wallet connection error:', err);
    const reason = getReadableWalletError(err);
    setChainStatus('Chain: Offline', false);
    btn.textContent = 'Failed — Retry';
    btn.style.borderColor = 'var(--red)';
    btn.style.color = 'var(--red)';
    alert(`Wallet connection failed: ${reason}`);
  }
}

function initWalletUI() {
  setChainStatus('Chain: Offline', false);
}

if (document.readyState !== 'loading') initWalletUI();
else document.addEventListener('DOMContentLoaded', initWalletUI);

// Blockchain Bridge — called by game.js after level completion
window.BlockchainBridge = {
  sessionId: null,
  challengeId: null,
  challengeType: 'normal',

  _normalizeSubscription(state) {
    const now = Date.now();
    const expiresAt = Number(state?.expiresAt || 0);
    const active = Boolean(state?.isActive && expiresAt > now);
    return {
      tier: active ? 'super_runner' : 'standard',
      isActive: active,
      startedAt: Number(state?.startedAt || 0) || null,
      expiresAt: active ? expiresAt : null,
      feeHbar: SUPER_RUNNER_SUBSCRIPTION_FEE_HBAR,
      bagLimitPerLevel: Number(state?.bagLimitPerLevel || (active ? 25 : 10)),
      maxActiveIntubations: Number(state?.maxActiveIntubations || (active ? 2 : 1)),
      rareChanceByDifficulty: active
        ? { easy: 1, med: 4, hard: 7, super: 10 }
        : null,
      isTrial: Boolean(state?.isTrial && active),
      txHash: state?.txHash || null,
    };
  },

  _trialStorageKey() {
    return walletAddress
      ? `chainrun_super_runner_trial_${walletAddress.toLowerCase()}`
      : 'chainrun_super_runner_trial_guest';
  },

  _hasUsedTrial() {
    try {
      const raw = localStorage.getItem(this._trialStorageKey());
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.used);
    } catch (err) {
      console.warn('Failed to read trial state:', err);
      return false;
    }
  },

  _markTrialUsed() {
    try {
      localStorage.setItem(this._trialStorageKey(), JSON.stringify({
        used: true,
        usedAt: Date.now(),
      }));
    } catch (err) {
      console.warn('Failed to save trial state:', err);
    }
  },

  canStartSuperRunnerTrial() {
    const sub = this.getSubscriptionStatus();
    return !sub?.isActive && !this._hasUsedTrial();
  },

  async startSuperRunnerTrial() {
    if (!walletConnected || !walletAddress) {
      throw new Error('Connect wallet to activate free trial');
    }

    const current = await this.ensureFreshSubscriptionStatus();
    if (current?.isActive) {
      throw new Error('Subscription already active');
    }
    if (this._hasUsedTrial()) {
      throw new Error('Free trial already used for this wallet');
    }

    const now = Date.now();
    const next = this._normalizeSubscription({
      isActive: true,
      isTrial: true,
      startedAt: now,
      expiresAt: now + SUPER_RUNNER_TRIAL_DAYS * 24 * 60 * 60 * 1000,
      bagLimitPerLevel: 25,
      maxActiveIntubations: 2,
      txHash: null,
    });
    this._saveSubscription(next);
    this._markTrialUsed();
    window.dispatchEvent(new CustomEvent('chainrun:subscription-updated'));

    return {
      success: true,
      trial: true,
      subscription: next,
    };
  },

  async refreshSubscriptionStatus() {
    if (!provider || !walletAddress || typeof ethers === 'undefined') {
      return this.getSubscriptionStatus();
    }

    const { address: contractAddress, contractAvailable } = await getSubscriptionPaymentTarget();
    if (!contractAvailable) {
      return this.getSubscriptionStatus();
    }

    try {
      const contract = new ethers.Contract(contractAddress, GAME_ABI, provider);
      const raw = await contract.getSubscriptionStatus(walletAddress);
      const chainState = this._normalizeSubscription({
        isActive: Boolean(raw?.active),
        expiresAt: Number(raw?.expiresAt?.toString?.() || raw?.expiresAt || 0) * 1000,
        bagLimitPerLevel: Number(raw?.bagLimit?.toString?.() || raw?.bagLimit || 10),
        maxActiveIntubations: Number(raw?.maxActiveIncubations?.toString?.() || raw?.maxActiveIncubations || 1),
      });
      const localState = this.getSubscriptionStatus();
      const effectiveState = (localState?.isTrial && localState?.isActive)
        ? localState
        : chainState;
      this._saveSubscription(effectiveState);
      window.dispatchEvent(new CustomEvent('chainrun:subscription-updated'));
      return effectiveState;
    } catch (err) {
      console.warn('Failed to refresh subscription from chain, using local cache:', err);
      return this.getSubscriptionStatus();
    }
  },

  async ensureFreshSubscriptionStatus() {
    try {
      return await this.refreshSubscriptionStatus();
    } catch (err) {
      console.warn('Subscription refresh failed, using cached state:', err);
      return this.getSubscriptionStatus();
    }
  },

  _subscriptionStorageKey() {
    return walletAddress
      ? `chainrun_subscription_${walletAddress.toLowerCase()}`
      : 'chainrun_subscription_guest';
  },

  _loadSubscription() {
    try {
      const raw = localStorage.getItem(this._subscriptionStorageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      console.warn('Failed to load subscription state:', err);
      return null;
    }
  },

  _saveSubscription(state) {
    try {
      localStorage.setItem(this._subscriptionStorageKey(), JSON.stringify(state || null));
    } catch (err) {
      console.warn('Failed to save subscription state:', err);
    }
  },

  getSubscriptionStatus() {
    const sub = this._loadSubscription();
    return this._normalizeSubscription(sub || {
      isActive: false,
      expiresAt: null,
      bagLimitPerLevel: 10,
      maxActiveIntubations: 1,
    });
  },

  async purchaseSuperRunnerSubscription() {
    if (!walletConnected || !signer) {
      throw new Error('Wallet connection required to buy Super Runner subscription');
    }

    const current = await this.ensureFreshSubscriptionStatus();
    if (current?.isActive) {
      return {
        success: true,
        skipped: true,
        subscription: current,
      };
    }

    const { address: paymentTarget, contractAvailable } = await getSubscriptionPaymentTarget();
    if (STRICT_ONCHAIN_MODE && !contractAvailable) {
      throw new Error('Subscription contract unavailable on decentralized network');
    }
    const value = ethers.utils.parseUnits(String(SUPER_RUNNER_SUBSCRIPTION_FEE_HBAR), CHAIN_CONFIG.nativeDecimals);

    const contract = new ethers.Contract(paymentTarget, GAME_ABI, signer);

    try {
      const tx = await contract.purchaseSuperRunnerSubscription({ value });
      await tx.wait();

      const refreshed = await this.refreshSubscriptionStatus();
      const next = {
        ...refreshed,
        txHash: tx.hash,
        startedAt: refreshed?.startedAt || Date.now(),
      };
      this._saveSubscription(next);
      window.dispatchEvent(new CustomEvent('chainrun:subscription-updated'));

      return {
        success: true,
        txHash: tx.hash,
        subscription: next,
      };
    } catch (err) {
      throw err;
    }
  },

  _rarityToCode(rarity) {
    const map = {
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      rarest: 5,
    };
    return map[String(rarity || 'common').toLowerCase()] ?? 0;
  },

  async startGameSession(levelId, betHbar) {
    if (!walletConnected || !signer) throw new Error('Wallet connection required for on-chain game session');
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const betWei = ethers.utils.parseUnits(betHbar.toString(), 8);
    const tx = await contract.startGame(levelId, { value: betWei });
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => e.event === 'GameStarted');
    this.sessionId = event?.args?.sessionId;
    if (!this.sessionId) throw new Error('Missing on-chain sessionId in GameStarted event');
    this.challengeType = 'normal';
    this.challengeId = null;
    return this.sessionId;
  },

  async createInstantChallenge(levelId, maxPlayers, betHbar) {
    if (!walletConnected || !signer) throw new Error('Wallet connection required for on-chain instant challenge');
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const betWei = ethers.utils.parseUnits(betHbar.toString(), 8);
    const returned = await contract.callStatic.createInstantChallenge(levelId, maxPlayers, { value: betWei });
    const tx = await contract.createInstantChallenge(levelId, maxPlayers, { value: betWei });
    await tx.wait();
    this.challengeId = returned[0].toString();
    this.sessionId = returned[1];
    this.challengeType = 'instant';
    return { challengeId: this.challengeId, sessionId: this.sessionId };
  },

  async joinInstantChallenge(challengeId, betHbar) {
    if (!walletConnected || !signer) throw new Error('Wallet connection required for on-chain instant challenge');
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const betWei = ethers.utils.parseUnits(betHbar.toString(), 8);
    const tx = await contract.joinInstantChallenge(challengeId, { value: betWei });
    const receipt = await tx.wait();
    const sessionId = receipt.events?.find(e => e.event === 'GameStarted')?.args?.sessionId;
    this.sessionId = sessionId;
    this.challengeId = challengeId;
    this.challengeType = 'instant';
    return { challengeId, sessionId };
  },

  async joinWeeklyChallenge(levelId, betHbar) {
    if (!walletConnected || !signer) throw new Error('Wallet connection required for on-chain weekly challenge');
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const betWei = ethers.utils.parseUnits(betHbar.toString(), 8);
    const returned = await contract.callStatic.joinWeeklyChallenge(levelId, { value: betWei });
    const tx = await contract.joinWeeklyChallenge(levelId, { value: betWei });
    await tx.wait();
    this.challengeId = returned[0].toString();
    this.sessionId = returned[1];
    this.challengeType = 'weekly';
    return { weeklyId: this.challengeId, sessionId: this.sessionId };
  },

  async submitScore(result) {
    if (!walletConnected || !signer) {
      throw new Error('Wallet connection required to submit score on-chain');
    }
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const sessionId = result?.sessionId || this.sessionId;
    if (!sessionId) {
      throw new Error('Missing on-chain session. Start the level from a connected wallet before submitting.');
    }
    if (!isBytes32Hex(sessionId)) {
      throw new Error('Invalid on-chain session id. Restart the run from a real blockchain session.');
    }
    const oracleProof = result.oracleProof || ethers.constants.HashZero;
    const tx = await contract.submitCompletion(
      sessionId,
      result.time,
      result.coins,
      oracleProof
    );
    await tx.wait();
    return { success: true };
  },

  async submitInstantScore(result) {
    if (!walletConnected || !signer) {
      return this.submitScore(result);
    }
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const sessionId = result?.sessionId || this.sessionId;
    if (!sessionId) {
      throw new Error('Missing on-chain instant challenge session. Rejoin the challenge and retry.');
    }
    if (!isBytes32Hex(sessionId)) {
      throw new Error('Invalid instant challenge session id. Rejoin the on-chain room and retry.');
    }
    const oracleProof = result.oracleProof || ethers.constants.HashZero;
    const tx = await contract.submitInstantCompletion(
      sessionId,
      result.time,
      result.coins,
      oracleProof
    );
    await tx.wait();
    return { success: true };
  },

  async submitWeeklyScore(result) {
    if (!walletConnected || !signer) {
      return this.submitScore(result);
    }
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const sessionId = result?.sessionId || this.sessionId;
    if (!sessionId) {
      throw new Error('Missing on-chain weekly challenge session. Join the weekly run again and retry.');
    }
    if (!isBytes32Hex(sessionId)) {
      throw new Error('Invalid weekly challenge session id. Join the weekly challenge again and retry.');
    }
    const oracleProof = result.oracleProof || ethers.constants.HashZero;
    const tx = await contract.submitWeeklyResult(
      sessionId,
      result.time,
      result.coins,
      oracleProof
    );
    await tx.wait();
    return { success: true };
  },

  async finalizeInstantChallenge(challengeId) {
    if (!walletConnected || !signer) {
      throw new Error('Wallet required to finalize instant challenge');
    }
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const tx = await contract.finalizeInstantChallenge(challengeId);
    await tx.wait();
    return { success: true };
  },

  async finalizeWeeklyChallenge(weeklyId) {
    if (!walletConnected || !signer) {
      throw new Error('Wallet required to finalize weekly challenge');
    }
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const tx = await contract.finalizeWeeklyChallenge(weeklyId);
    await tx.wait();
    return { success: true };
  },

  isWalletConnected() {
    return Boolean(walletConnected && walletAddress);
  },

  getWalletAddress() {
    return walletAddress || null;
  },

  async payMarketTrade(amountHbar, routeId) {
    if (!walletConnected || !signer) {
      throw new Error('Wallet connection required for trade payment');
    }
    const route = Number(routeId);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const value = ethers.utils.parseUnits(String(amountHbar), 8);
    const tx = await contract.executeMaterialTrade(route, { value });
    await tx.wait();
    return { success: true, txHash: tx.hash, routeId: route };
  },

  async getMaterialBalance(rarityCode) {
    if (!provider || !walletAddress) return 0;
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    const bal = await contract.getMaterialBalance(walletAddress, Number(rarityCode));
    return Number(bal.toString());
  },

  async getPlayerProfile(address) {
    if (!provider) return null;
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    return contract.getPlayerProfile(address || walletAddress);
  },

  async getLevelPool(levelId) {
    if (!provider) return '0';
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    const pool = await contract.getLevelPool(levelId);
    return ethers.utils.formatUnits(pool, 8); // convert tinybars → HBAR
  },

  async verifyAndSubmitScore(result) {
    if (!result) throw new Error('No game result to submit');

    if (result.challengeType === 'instant') {
      return this.verifyAndSubmitInstantScore(result);
    }
    if (result.challengeType === 'weekly') {
      return this.verifyAndSubmitWeeklyScore(result);
    }

    if (!walletConnected || !signer) {
      return this.submitScore(result);
    }

    const payload = await requestOracleVerification({
      player: walletAddress,
      levelId: result.level,
      claimedTime: result.time,
      inputEvents: result.inputEvents || [],
      stateHashes: result.stateHashes || []
    });

    return this.submitScore({ ...result, oracleProof: payload.proof });
  },

  async verifyAndSubmitInstantScore(result) {
    if (!result) throw new Error('No instant result to submit');

    if (!walletConnected || !signer) {
      return this.submitScore(result);
    }

    const payload = await requestOracleVerification({
      player: walletAddress,
      levelId: result.level,
      claimedTime: result.time,
      inputEvents: result.inputEvents || [],
      stateHashes: result.stateHashes || []
    });

    return this.submitInstantScore({ ...result, oracleProof: payload.proof });
  },

  async verifyAndSubmitWeeklyScore(result) {
    if (!result) throw new Error('No weekly result to submit');

    if (!walletConnected || !signer) {
      return this.submitScore(result);
    }

    const payload = await requestOracleVerification({
      player: walletAddress,
      levelId: result.level,
      claimedTime: result.time,
      inputEvents: result.inputEvents || [],
      stateHashes: result.stateHashes || []
    });

    return this.submitWeeklyScore({ ...result, oracleProof: payload.proof });
  },

  async getActiveChallenges() {
    if (!provider) return [];
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    try {
      const count = await contract.instantChallengeCounter();
      const challenges = [];
      for (let i = Math.max(1, count - 10); i <= count; i++) {
        const ch = await contract.instantChallenges(i);
        if (ch.active) {
          challenges.push({
            id: i,
            levelId: ch.levelId.toNumber(),
            betTinybars: ch.betTinybars.toNumber(),
            totalPool: ch.totalPool.toNumber(),
            maxPlayers: ch.maxPlayers.toNumber(),
            playersCount: ch.playersCount.toNumber(),
            active: ch.active
          });
        }
      }
      return challenges.reverse();
    } catch (err) {
      console.warn('Failed to fetch active challenges:', err);
      return [];
    }
  },

  async getWeeklyInfo(levelId) {
    if (!provider) return null;
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    try {
      const activeId = await contract.activeWeeklyByLevel(levelId);
      if (activeId.toNumber() === 0) return null;
      
      const weekly = await contract.weeklyChallenges(activeId);
      return {
        id: activeId.toNumber(),
        levelId: weekly.levelId.toNumber(),
        totalPool: weekly.totalPool.toNumber(),
        bestTime: weekly.bestTime.toNumber(),
        startAt: weekly.startAt.toNumber(),
        endAt: weekly.endAt.toNumber(),
        active: weekly.active,
        participantCount: 0,
        leaderboard: []
      };
    } catch (err) {
      console.warn('Failed to fetch weekly info:', err);
      return null;
    }
  },

  _incubationStorageKey() {
    return walletAddress
      ? `chainrun_incubations_${walletAddress.toLowerCase()}`
      : 'chainrun_incubations_guest';
  },

  _incubationMetaStorageKey() {
    return walletAddress
      ? `chainrun_incubation_meta_${walletAddress.toLowerCase()}`
      : 'chainrun_incubation_meta_guest';
  },

  _loadIncubationMeta() {
    try {
      const raw = localStorage.getItem(this._incubationMetaStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.warn('Failed to load incubation metadata:', err);
      return {};
    }
  },

  _saveIncubationMeta(meta) {
    try {
      localStorage.setItem(this._incubationMetaStorageKey(), JSON.stringify(meta || {}));
    } catch (err) {
      console.warn('Failed to save incubation metadata:', err);
    }
  },

  _dropHash(drop) {
    const safe = {
      name: drop?.name || '',
      rarity: drop?.rarity || '',
      levelId: Number(drop?.levelId || 0),
      difficulty: drop?.difficulty || '',
      mintCost: Number(drop?.mintCost || 0),
      source: drop?.source || ''
    };
    const e = (typeof globalThis !== 'undefined' && globalThis.ethers) ? globalThis.ethers : null;
    if (!e) {
      // Deterministic fallback key so local mode works even when ethers is unavailable.
      return [safe.name, safe.rarity, safe.levelId, safe.difficulty, safe.mintCost, safe.source].join('|');
    }
    if (e.utils?.solidityKeccak256) {
      return e.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'string', 'uint256', 'string'],
        [safe.name, safe.rarity, safe.levelId, safe.difficulty, safe.mintCost, safe.source]
      );
    }
    if (e.solidityPackedKeccak256) {
      return e.solidityPackedKeccak256(
        ['string', 'string', 'uint256', 'string', 'uint256', 'string'],
        [safe.name, safe.rarity, safe.levelId, safe.difficulty, safe.mintCost, safe.source]
      );
    }
    return [safe.name, safe.rarity, safe.levelId, safe.difficulty, safe.mintCost, safe.source].join('|');
  },

  _incubationContract(readonly = false) {
    if (readonly) {
      if (!provider) return null;
      return new ethers.Contract(
        CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
      );
    }

    if (!walletConnected || !signer) return null;
    return new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
  },

  _loadIncubations() {
    try {
      const raw = localStorage.getItem(this._incubationStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to load incubations:', err);
      return [];
    }
  },

  _eggCollectorStorageKey() {
    return walletAddress
      ? `chainrun_egg_bag_${walletAddress.toLowerCase()}`
      : 'chainrun_egg_bag_guest';
  },

  _loadEggCollectorBag() {
    try {
      const raw = localStorage.getItem(this._eggCollectorStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.warn('Failed to load egg collector bag:', err);
      return {};
    }
  },

  _saveEggCollectorBag(bag) {
    try {
      localStorage.setItem(this._eggCollectorStorageKey(), JSON.stringify(bag || {}));
    } catch (err) {
      console.warn('Failed to save egg collector bag:', err);
    }
  },

  async collectEggToBag(drop, levelId) {
    const lv = Number(levelId || drop?.levelId || 1);
    if (!walletConnected || !signer || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required for on-chain egg collection');
    }
    await this.refreshSubscriptionStatus();

    const bag = this._loadEggCollectorBag();
    const key = String(lv);
    bag[key] = Array.isArray(bag[key]) ? bag[key] : [];
    const bagLimit = Number(this.getSubscriptionStatus().bagLimitPerLevel || 10);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const onchainCount = Number((await contract.getEggCollectorCount(walletAddress, lv)).toString());
    if (onchainCount >= bagLimit) {
      return {
        levelId: lv,
        localCount: bag[key].length,
        bagLimit,
        stored: false,
        full: true,
      };
    }

    const tx = await contract.addEggToCollector(lv);
    await tx.wait();

    bag[key].push(drop);
    this._saveEggCollectorBag(bag);

    return {
      levelId: lv,
      localCount: bag[key].length,
      bagLimit,
      stored: true,
      full: false,
    };
  },

  async getEggCollectorBag(levelId) {
    if (!walletConnected || !walletAddress || !provider || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required to read on-chain egg collector');
    }

    const lv = Number(levelId || 1);
    const key = String(lv);
    const bag = this._loadEggCollectorBag();
    const items = Array.isArray(bag[key]) ? bag[key] : [];
    let onchainCount = 0;
    const bagLimit = Number(this.getSubscriptionStatus().bagLimitPerLevel || 10);

    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, provider
    );
    const cnt = await contract.getEggCollectorCount(walletAddress, lv);
    onchainCount = Number(cnt.toString());

    return {
      levelId: lv,
      count: onchainCount,
      onchainCount,
      bagLimit,
      items
    };
  },

  async intubateEggFromBag(drop, levelId) {
    if (!walletConnected || !signer || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required for on-chain intubation');
    }

    const lv = Number(levelId || drop?.levelId || 1);
    const now = Date.now();
    const existing = await this.getMaterialIncubations();
    const activeCount = (existing || []).filter(i => !i.claimed && (i.readyAt || 0) > now).length;
    const maxActive = Number(this.getSubscriptionStatus().maxActiveIntubations || 1);
    if (activeCount >= maxActive) {
      throw new Error(`Max active intubations reached (${maxActive})`);
    }

    const rarityCode = this._rarityToCode(drop?.rarity);
    const dropHash = this._dropHash(drop);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES[CHAIN_CONFIG.key].DaveChainGame, GAME_ABI, signer
    );
    const incubationId = await contract.callStatic.incubateEggFromCollector(lv, dropHash, rarityCode);
    const tx = await contract.incubateEggFromCollector(lv, dropHash, rarityCode);
    await tx.wait();

    const bag = this._loadEggCollectorBag();
    const key = String(lv);
    if (Array.isArray(bag[key]) && bag[key].length) {
      bag[key].shift();
      this._saveEggCollectorBag(bag);
    }

    const meta = this._loadIncubationMeta();
    meta[dropHash.toLowerCase()] = drop;
    this._saveIncubationMeta(meta);

    return {
      id: Number(incubationId).toString(),
      createdAt: now,
      readyAt: now + 3 * 24 * 60 * 60 * 1000,
      durationSeconds: 3 * 24 * 60 * 60,
      drop,
      dropHash,
      chainAnchor: 'evm-testnet',
      status: 'incubating'
    };
  },

  _saveIncubations(list) {
    try {
      localStorage.setItem(this._incubationStorageKey(), JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save incubations:', err);
    }
  },

  async startMaterialIncubation(drop, durationSeconds) {
    if (!walletConnected || !signer || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required for on-chain incubation');
    }

    const safeDuration = Math.max(1, Number(durationSeconds || 300));
    const contract = this._incubationContract(false);
    const dropHash = this._dropHash(drop);
    const rarityCode = this._rarityToCode(drop?.rarity);
    const incubationId = await contract.callStatic.startMaterialIncubationWithRarity(dropHash, safeDuration, rarityCode);
    const tx = await contract.startMaterialIncubationWithRarity(dropHash, safeDuration, rarityCode);
    await tx.wait();

    const meta = this._loadIncubationMeta();
    meta[dropHash.toLowerCase()] = drop;
    this._saveIncubationMeta(meta);

    const now = Date.now();
    return {
      id: Number(incubationId).toString(),
      createdAt: now,
      readyAt: now + safeDuration * 1000,
      durationSeconds: safeDuration,
      drop,
      dropHash,
      chainAnchor: 'evm-testnet',
      status: 'incubating'
    };
  },

  async getMaterialIncubations() {
    if (!walletConnected || !walletAddress || !provider || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required to read on-chain incubations');
    }

    try {
      const contract = this._incubationContract(true);
      const countBN = await contract.getMaterialIncubationCount(walletAddress);
      const count = Number(countBN.toString());
      const meta = this._loadIncubationMeta();
      const chainList = [];

      const start = count > 100 ? count - 99 : 1;
      for (let id = start; id <= count; id++) {
        const inc = await contract.getMaterialIncubation(walletAddress, id);
        if (!inc || Number(inc.id.toString()) === 0) continue;
        const dropHash = String(inc.dropHash).toLowerCase();
        chainList.push({
          id: String(inc.id),
          createdAt: Number(inc.startAt) * 1000,
          readyAt: Number(inc.readyAt) * 1000,
          durationSeconds: Number(inc.durationSeconds),
          rarityCode: Number(inc.rarityCode),
          claimed: Boolean(inc.claimed),
          dropHash,
          drop: meta[dropHash] || null,
          chainAnchor: 'evm-testnet',
          status: Boolean(inc.claimed) ? 'claimed' : 'incubating'
        });
      }

      return chainList;
    } catch (err) {
      throw err;
    }
  },

  async claimReadyMaterialIncubations() {
    if (!walletConnected || !walletAddress || !signer || !provider || typeof ethers === 'undefined') {
      throw new Error('Wallet connection required to claim on-chain incubations');
    }

    const now = Date.now();
    const readonlyContract = this._incubationContract(true);
    const signerContract = this._incubationContract(false);
    const count = Number((await readonlyContract.getMaterialIncubationCount(walletAddress)).toString());
    const toClaim = [];
    const claimPayload = [];
    const meta = this._loadIncubationMeta();

    const start = count > 100 ? count - 99 : 1;
    for (let id = start; id <= count; id++) {
      const inc = await readonlyContract.getMaterialIncubation(walletAddress, id);
      if (!inc || Number(inc.id.toString()) === 0) continue;
      const readyAtMs = Number(inc.readyAt) * 1000;
      const alreadyClaimed = Boolean(inc.claimed);
      if (!alreadyClaimed && readyAtMs <= now) {
        toClaim.push(id);
        const dropHash = String(inc.dropHash).toLowerCase();
        claimPayload.push({
          id: String(id),
          dropHash,
          drop: meta[dropHash] || null,
          createdAt: Number(inc.startAt) * 1000,
          readyAt: readyAtMs,
          durationSeconds: Number(inc.durationSeconds),
          rarityCode: Number(inc.rarityCode),
          chainAnchor: 'evm-testnet',
          status: 'claimed'
        });
      }
    }

    if (toClaim.length > 0) {
      const tx = await signerContract.claimReadyMaterialIncubations(toClaim);
      await tx.wait();
    }

    return claimPayload;
  }
};
