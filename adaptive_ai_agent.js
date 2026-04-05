// adaptive_ai_agent.js
// Lightweight adaptive difficulty agent for retry easing and next-level hardening.

(function () {
  const STORAGE_KEY = 'chainrun_adaptive_agent_v1';

  const defaultState = {
    deathsByLevel: {},
    harderNextByLevel: {},
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return { ...defaultState };
      return {
        deathsByLevel: parsed.deathsByLevel && typeof parsed.deathsByLevel === 'object' ? parsed.deathsByLevel : {},
        harderNextByLevel: parsed.harderNextByLevel && typeof parsed.harderNextByLevel === 'object' ? parsed.harderNextByLevel : {},
      };
    } catch {
      return { ...defaultState };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage failures in browser privacy modes.
    }
  }

  const state = loadState();

  function getDeaths(levelId) {
    return Number(state.deathsByLevel[String(levelId)] || 0);
  }

  function setDeaths(levelId, value) {
    state.deathsByLevel[String(levelId)] = Math.max(0, Number(value || 0));
    saveState(state);
  }

  function markHarderNext(levelId, multiplier) {
    state.harderNextByLevel[String(levelId)] = Number(multiplier || 1.15);
    saveState(state);
  }

  function consumeHarderNext(levelId) {
    const key = String(levelId);
    const m = Number(state.harderNextByLevel[key] || 0);
    if (m > 0) {
      delete state.harderNextByLevel[key];
      saveState(state);
      return m;
    }
    return 0;
  }

  const AdaptiveDifficultyAgent = {
    getTuning(level) {
      const levelId = Number(level?.id || 1);
      const deaths = getDeaths(levelId);
      const harderBoost = consumeHarderNext(levelId);

      const tuning = {
        enemySpawnMultiplier: 1,
        enemySpeedMultiplier: 1,
        platformGapMultiplier: 1,
        timeBonusSeconds: 0,
        label: 'normal',
      };

      // Retry assist: after >3 deaths on this level, reduce enemies and ease completion slightly.
      if (deaths > 3) {
        const extra = Math.min(0.22, (deaths - 3) * 0.03);
        tuning.enemySpawnMultiplier *= (1 - extra);
        tuning.enemySpeedMultiplier *= (1 - extra * 0.45);
        tuning.platformGapMultiplier *= (1 - extra * 0.35);
        tuning.timeBonusSeconds += Math.min(18, Math.round((deaths - 3) * 2));
        tuning.label = 'assist';
      }

      // Next level harden: one-time 15% harder after easy completion.
      if (harderBoost > 0) {
        tuning.enemySpawnMultiplier *= harderBoost;
        tuning.enemySpeedMultiplier *= harderBoost;
        tuning.platformGapMultiplier *= 1.08;
        tuning.timeBonusSeconds -= Math.max(4, Math.round((level?.time || 60) * 0.08));
        tuning.label = tuning.label === 'assist' ? 'assist+challenge' : 'challenge';
      }

      return tuning;
    },

    recordDeath(levelId) {
      setDeaths(levelId, getDeaths(levelId) + 1);
    },

    recordLevelClear(level, metrics) {
      const levelId = Number(level?.id || 1);
      const nextLevelId = Math.min(10, levelId + 1);
      const deathsBeforeClear = getDeaths(levelId);
      const attempts = deathsBeforeClear + 1;

      // Clear retry pressure on win.
      setDeaths(levelId, 0);

      // Requested progression rule:
      // 1st attempt clear  -> next level 15% harder
      // 2nd attempt clear  -> next level 7% harder
      // 3rd attempt clear  -> no harder change
      if (attempts === 1) {
        markHarderNext(nextLevelId, 1.15);
      } else if (attempts === 2) {
        markHarderNext(nextLevelId, 1.07);
      } else if (attempts >= 3) {
        delete state.harderNextByLevel[String(nextLevelId)];
        saveState(state);
      }
    },

    getStateSnapshot() {
      return JSON.parse(JSON.stringify(state));
    },
  };

  window.AdaptiveDifficultyAgent = AdaptiveDifficultyAgent;
})();
