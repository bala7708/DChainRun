// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
//  DaveChainGame.sol
//  Deployed on Hedera EVM-compatible network
//
//  Prize split: 95% → fastest player, 5% → service fee
//  EXP: base level reward + coins*5 + time_remaining*2
//  Ranks: Novice(0) → Warrior(2000) → Hero(8000) → Master(20000) → Legend(50000)
// ============================================================

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IGameOracle {
    function verifyCompletionTime(
        address player,
        uint256 levelId,
        uint256 claimedTime,
        bytes calldata proof
    ) external returns (bool valid, uint256 verifiedTime);
}

interface IExpToken {
    function mint(address to, uint256 amount) external;
}

contract DaveChainGame is Ownable, ReentrancyGuard, Pausable {

    // ── Constants ──────────────────────────────────────────
    uint256 public constant SERVICE_FEE_BPS = 500;   // 5%
    uint256 public constant WINNER_BPS      = 9500;  // 95%
    uint256 public constant BASIS           = 10000;
    uint256 public constant EGG_HATCH_DURATION = 3 days;
    uint8 public constant RARITY_COMMON     = 0;
    uint8 public constant RARITY_UNCOMMON   = 1;
    uint8 public constant RARITY_RARE       = 2;
    uint8 public constant RARITY_EPIC       = 3;
    uint8 public constant RARITY_LEGENDARY  = 4;
    uint8 public constant RARITY_RAREST     = 5;

    uint8 public constant TRADE_ROUTE_SR_TO_RARE   = 1;
    uint8 public constant TRADE_ROUTE_SR_TO_COMMON = 2;
    uint256 public constant TRADE_FEE_SR_TO_RARE_TINYBARS   = 320000000; // 3.2 HBAR
    uint256 public constant TRADE_FEE_SR_TO_COMMON_TINYBARS = 140000000; // 1.4 HBAR
    uint256 public constant SUPER_RUNNER_SUBSCRIPTION_FEE_TINYBARS = 1200000000; // 12 HBAR
    uint256 public constant SUPER_RUNNER_SUBSCRIPTION_DURATION = 30 days;
    uint256 public constant STANDARD_BAG_LIMIT = 10;
    uint256 public constant SUPER_RUNNER_BAG_LIMIT = 25;
    uint256 public constant STANDARD_MAX_ACTIVE_INCUBATIONS = 1;
    uint256 public constant SUPER_RUNNER_MAX_ACTIVE_INCUBATIONS = 2;

    uint256[10] public MIN_BETS_HBAR   = [5,5,10,10,15,20,20,25,50,100];
    uint256[10] public TIME_LIMITS_SEC = [120,110,100,90,85,80,75,70,60,50];
    uint256[10] public BASE_EXP_REWARD = [100,150,200,250,300,400,450,500,700,1000];

    // ── External contracts ─────────────────────────────────
    IGameOracle public oracle;
    IExpToken    public expToken;

    // ── Data structures ────────────────────────────────────
    struct Level {
        uint256 id;
        uint256 minBetTinybars;  // 1 HBAR = 1e8 tinybars on Hedera
        uint256 timeLimit;
        uint256 totalPool;
        uint256 expReward;
        bool    active;
    }

    struct GameSession {
        address  player;
        uint256  levelId;
        uint256  betAmount;
        uint256  startTimestamp;
        uint256  completionTime;   // seconds taken
        bool     completed;
        bool     claimed;
        uint256  coinsCollected;
        uint256  expEarned;
        bytes32  sessionId;
        uint8    challengeType;    // 0=normal, 1=instant, 2=weekly
        uint256  challengeId;
    }

    struct InstantChallenge {
        uint256 id;
        uint256 levelId;
        uint256 betTinybars;
        uint256 totalPool;
        uint256 maxPlayers;
        uint256 createdAt;
        uint256 playersCount;
        uint256 completedCount;
        bool     active;
        bool     resolved;
        address  winner;
        uint256  winningTime;
        bytes32[] sessionIds;
    }

    struct WeeklyChallenge {
        uint256 id;
        uint256 levelId;
        uint256 totalPool;
        uint256 bestTime;
        address bestPlayer;
        uint256 startAt;
        uint256 endAt;
        bool     active;
        bool     paid;
        bytes32[] sessionIds;
    }

    struct PlayerProfile {
        uint256 totalExp;
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 bestTime;
        uint256 totalWinnings;
        uint256 rank;              // 0=Novice 1=Warrior 2=Hero 3=Master 4=Legend
        uint256 lastActive;
    }

    struct MaterialIncubation {
        uint256 id;
        bytes32 dropHash;
        uint8 rarityCode;
        uint256 startAt;
        uint256 readyAt;
        uint256 durationSeconds;
        bool claimed;
    }

    // ── Storage ────────────────────────────────────────────
    mapping(uint256 => Level)         public levels;
    mapping(bytes32 => GameSession)   public sessions;
    mapping(address => PlayerProfile) public profiles;
    mapping(address => bytes32[])     public playerSessions;

    mapping(uint256 => InstantChallenge) public instantChallenges;
    mapping(uint256 => mapping(address => bool)) public instantJoined;

    mapping(uint256 => WeeklyChallenge) public weeklyChallenges;
    mapping(uint256 => mapping(address => bool)) public weeklyJoined;
    mapping(uint256 => uint256) public activeWeeklyByLevel;

    mapping(address => uint256) public materialIncubationCount;
    mapping(address => mapping(uint256 => MaterialIncubation)) private materialIncubations;
    mapping(address => mapping(uint8 => uint256)) public materialBalances;
    mapping(address => mapping(uint256 => uint256)) public eggCollectorByLevel;
    mapping(address => uint256) public activeIncubationId;
    mapping(address => uint256) public activeIncubationCount;
    mapping(address => uint256) public superRunnerExpiryAt;

    uint256 public instantChallengeCounter;
    uint256 public weeklyChallengeCounter;

    // Best time per level → (time, player)
    mapping(uint256 => uint256)       public levelBestTime;
    mapping(uint256 => address)       public levelLeader;

    uint256 public totalFeesCollected;
    uint256 public totalPrizesDistributed;

    // ── Events ─────────────────────────────────────────────
    event GameStarted(bytes32 indexed sessionId, address indexed player, uint256 levelId, uint256 bet);
    event GameCompleted(bytes32 indexed sessionId, uint256 verifiedTime, uint256 exp);
    event PrizePaid(address indexed winner, uint256 amount, uint256 levelId);
    event NewLevelLeader(address indexed player, uint256 levelId, uint256 newTime, uint256 oldTime);
    event InstantChallengeCreated(uint256 indexed challengeId, uint256 levelId, uint256 betTinybars, uint256 maxPlayers, address indexed creator);
    event InstantChallengeJoined(uint256 indexed challengeId, address indexed player, uint256 betTinybars);
    event InstantChallengeResolved(uint256 indexed challengeId, address indexed winner, uint256 winningTime, uint256 winnerAmount, uint256 feeAmount);
    event WeeklyChallengeJoined(uint256 indexed weeklyId, uint256 levelId, address indexed player, uint256 betTinybars);
    event WeeklyChallengeResultUpdated(uint256 indexed weeklyId, address indexed player, uint256 bestTime);
    event WeeklyChallengeFinalized(uint256 indexed weeklyId, address indexed winner, uint256 winnerAmount, uint256 feeAmount);
    event ExpMinted(address indexed player, uint256 amount);
    event RankUpdated(address indexed player, uint256 oldRank, uint256 newRank);
    event MaterialIncubationStarted(address indexed player, uint256 indexed incubationId, bytes32 indexed dropHash, uint256 readyAt);
    event MaterialIncubationClaimed(address indexed player, uint256 indexed incubationId, bytes32 indexed dropHash);
    event MaterialTradeExecuted(
        address indexed player,
        uint8 indexed routeId,
        uint8 inputRarity,
        uint256 inputQty,
        uint8 outputRarity,
        uint256 outputQty,
        uint256 feePaid
    );
    event EggCollectedToBag(address indexed player, uint256 indexed levelId, uint256 levelCount);
    event EggIntubated(address indexed player, uint256 indexed levelId, uint256 indexed incubationId, uint256 readyAt);
    event SuperRunnerSubscribed(address indexed player, uint256 expiresAt, uint256 amountPaid);

    // ── Constructor ────────────────────────────────────────
    constructor(address _oracle, address _expToken) Ownable(msg.sender) {
        oracle   = IGameOracle(_oracle);
        expToken = IExpToken(_expToken);
        _initLevels();
    }

    function _initLevels() internal {
        for (uint256 i = 0; i < 10; i++) {
            levels[i + 1] = Level({
                id:               i + 1,
                minBetTinybars:   MIN_BETS_HBAR[i] * 1e8,
                timeLimit:        TIME_LIMITS_SEC[i],
                totalPool:        0,
                expReward:        BASE_EXP_REWARD[i],
                active:           true
            });
        }
    }

    // ── Core functions ─────────────────────────────────────

    /// @notice Player enters a level by paying the minimum bet
    function startGame(uint256 levelId)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (bytes32 sessionId)
    {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        Level storage lv = levels[levelId];
        require(lv.active, "Level not active");
        require(msg.value >= lv.minBetTinybars, "Bet below minimum");

        sessionId = keccak256(abi.encodePacked(
            msg.sender, levelId, block.timestamp, block.prevrandao, playerSessions[msg.sender].length
        ));
        require(sessions[sessionId].player == address(0), "Session collision");

        sessions[sessionId] = GameSession({
            player:         msg.sender,
            levelId:        levelId,
            betAmount:      msg.value,
            startTimestamp: block.timestamp,
            completionTime: 0,
            completed:      false,
            claimed:        false,
            coinsCollected: 0,
            expEarned:      0,
            sessionId:      sessionId,
            challengeType:  0,
            challengeId:    0
        });

        lv.totalPool += msg.value;
        playerSessions[msg.sender].push(sessionId);
        profiles[msg.sender].gamesPlayed++;
        profiles[msg.sender].lastActive = block.timestamp;

        emit GameStarted(sessionId, msg.sender, levelId, msg.value);
    }

    /// @notice Submit a level completion proof to the Hedera oracle
    function submitCompletion(
        bytes32 sessionId,
        uint256 completionTime,
        uint256 coinsCollected,
        bytes calldata oracleProof
    )
        external
        nonReentrant
        whenNotPaused
    {
        GameSession storage gs = sessions[sessionId];
        require(gs.player == msg.sender,    "Not your session");
        require(!gs.completed,              "Already completed");
        require(gs.startTimestamp > 0,      "Session not found");

        Level storage lv = levels[gs.levelId];
        require(completionTime > 0 && completionTime <= lv.timeLimit, "Invalid time");
        require(coinsCollected <= 9999,     "Invalid coin count");

        // Verify with Hedera oracle service (anti-cheat oracle)
        (bool valid, uint256 verifiedTime) = oracle.verifyCompletionTime(
            msg.sender, gs.levelId, completionTime, oracleProof
        );
        require(valid, "Oracle rejected: possible cheating detected");

        gs.completionTime  = verifiedTime;
        gs.coinsCollected  = coinsCollected;
        gs.completed       = true;

        // Calculate EXP
        uint256 timeBonus  = (lv.timeLimit - verifiedTime) * 2;
        uint256 coinBonus  = coinsCollected * 5;
        uint256 expEarned  = lv.expReward + coinBonus + timeBonus;
        gs.expEarned       = expEarned;

        // Update profile
        PlayerProfile storage pp = profiles[msg.sender];
        uint256 oldRank = pp.rank;
        pp.totalExp   += expEarned;
        pp.gamesWon++;
        if (pp.bestTime == 0 || verifiedTime < pp.bestTime) pp.bestTime = verifiedTime;
        _updateRank(msg.sender);
        if (pp.rank != oldRank) emit RankUpdated(msg.sender, oldRank, pp.rank);

        // Mint EXP tokens via Hedera HTS
        expToken.mint(msg.sender, expEarned);
        emit ExpMinted(msg.sender, expEarned);

        // Check for new level leader
        uint256 currentBest = levelBestTime[gs.levelId];
        if (currentBest == 0 || verifiedTime < currentBest) {
            uint256 oldBest = currentBest;
            levelBestTime[gs.levelId] = verifiedTime;
            levelLeader[gs.levelId]   = msg.sender;
            emit NewLevelLeader(msg.sender, gs.levelId, verifiedTime, oldBest);
            _distributePrize(gs.levelId, msg.sender);
        }

        emit GameCompleted(sessionId, verifiedTime, expEarned);
    }

    /// @dev Distribute prize pool: 95% to winner, 5% to owner
    function _distributePrize(uint256 levelId, address winner) internal {
        Level storage lv = levels[levelId];
        uint256 pool = lv.totalPool;
        if (pool == 0) return;

        uint256 winnerAmount = (pool * WINNER_BPS) / BASIS;
        uint256 feeAmount    = pool - winnerAmount;

        lv.totalPool = 0;
        profiles[winner].totalWinnings += winnerAmount;
        totalFeesCollected += feeAmount;
        totalPrizesDistributed += winnerAmount;

        (bool ok,)  = winner.call{value: winnerAmount}("");
        require(ok, "Prize transfer failed");
        (bool feeOk,) = owner().call{value: feeAmount}("");
        require(feeOk, "Fee transfer failed");

        emit PrizePaid(winner, winnerAmount, levelId);
    }

    function createInstantChallenge(uint256 levelId, uint256 maxPlayers)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 challengeId, bytes32 sessionId)
    {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        require(maxPlayers >= 2 && maxPlayers <= 5, "Players must be 2-5");

        Level storage lv = levels[levelId];
        require(lv.active, "Level not active");
        require(msg.value >= lv.minBetTinybars, "Bet below minimum");

        challengeId = ++instantChallengeCounter;
        InstantChallenge storage ic = instantChallenges[challengeId];
        ic.id = challengeId;
        ic.levelId = levelId;
        ic.betTinybars = msg.value;
        ic.totalPool = msg.value;
        ic.maxPlayers = maxPlayers;
        ic.createdAt = block.timestamp;
        ic.playersCount = 1;
        ic.active = true;
        ic.resolved = false;
        ic.playersCount = 1;
        ic.sessionIds.push();

        sessionId = keccak256(abi.encodePacked(
            msg.sender,
            levelId,
            challengeId,
            block.timestamp,
            block.prevrandao,
            playerSessions[msg.sender].length
        ));

        sessions[sessionId] = GameSession({
            player:         msg.sender,
            levelId:        levelId,
            betAmount:      msg.value,
            startTimestamp: block.timestamp,
            completionTime: 0,
            completed:      false,
            claimed:        false,
            coinsCollected: 0,
            expEarned:      0,
            sessionId:      sessionId,
            challengeType:  1,
            challengeId:    challengeId
        });

        ic.sessionIds[ic.sessionIds.length - 1] = sessionId;
        instantJoined[challengeId][msg.sender] = true;
        playerSessions[msg.sender].push(sessionId);

        emit InstantChallengeCreated(challengeId, levelId, msg.value, maxPlayers, msg.sender);
        emit GameStarted(sessionId, msg.sender, levelId, msg.value);
    }

    function joinInstantChallenge(uint256 challengeId)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (bytes32 sessionId)
    {
        InstantChallenge storage ic = instantChallenges[challengeId];
        require(ic.active, "Challenge not active");
        require(!instantJoined[challengeId][msg.sender], "Already joined");
        require(ic.playersCount < ic.maxPlayers, "Challenge full");
        require(msg.value == ic.betTinybars, "Bet must match challenge stakes");

        ic.totalPool += msg.value;
        ic.playersCount += 1;

        sessionId = keccak256(abi.encodePacked(
            msg.sender,
            challengeId,
            block.timestamp,
            block.prevrandao,
            playerSessions[msg.sender].length
        ));

        sessions[sessionId] = GameSession({
            player:         msg.sender,
            levelId:        ic.levelId,
            betAmount:      msg.value,
            startTimestamp: block.timestamp,
            completionTime: 0,
            completed:      false,
            claimed:        false,
            coinsCollected: 0,
            expEarned:      0,
            sessionId:      sessionId,
            challengeType:  1,
            challengeId:    challengeId
        });

        ic.sessionIds.push(sessionId);
        instantJoined[challengeId][msg.sender] = true;
        playerSessions[msg.sender].push(sessionId);

        emit InstantChallengeJoined(challengeId, msg.sender, msg.value);
        emit GameStarted(sessionId, msg.sender, ic.levelId, msg.value);
    }

    function submitInstantCompletion(
        bytes32 sessionId,
        uint256 completionTime,
        uint256 coinsCollected,
        bytes calldata oracleProof
    )
        external
        nonReentrant
        whenNotPaused
    {
        GameSession storage gs = sessions[sessionId];
        require(gs.challengeType == 1, "Not instant challenge");
        require(gs.player == msg.sender, "Not your session");
        require(!gs.completed, "Already completed");
        require(gs.startTimestamp > 0, "Session not found");

        Level storage lv = levels[gs.levelId];
        require(completionTime > 0 && completionTime <= lv.timeLimit, "Invalid time");
        require(coinsCollected <= 9999, "Invalid coin count");

        (bool valid, uint256 verifiedTime) = oracle.verifyCompletionTime(
            msg.sender, gs.levelId, completionTime, oracleProof
        );
        require(valid, "Oracle rejected: possible cheating detected");

        gs.completionTime = verifiedTime;
        gs.coinsCollected = coinsCollected;
        gs.completed = true;

        uint256 timeBonus = (lv.timeLimit - verifiedTime) * 2;
        uint256 coinBonus = coinsCollected * 5;
        uint256 expEarned = lv.expReward + coinBonus + timeBonus;
        gs.expEarned = expEarned;

        PlayerProfile storage pp = profiles[msg.sender];
        uint256 oldRank = pp.rank;
        pp.totalExp += expEarned;
        pp.gamesWon++;
        if (pp.bestTime == 0 || verifiedTime < pp.bestTime) pp.bestTime = verifiedTime;
        _updateRank(msg.sender);
        if (pp.rank != oldRank) emit RankUpdated(msg.sender, oldRank, pp.rank);

        expToken.mint(msg.sender, expEarned);
        emit ExpMinted(msg.sender, expEarned);

        uint256 challengeId = gs.challengeId;
        InstantChallenge storage ic = instantChallenges[challengeId];
        ic.completedCount += 1;

        if (ic.completedCount == ic.playersCount) {
            _resolveInstantChallenge(challengeId);
        }

        emit GameCompleted(sessionId, verifiedTime, expEarned);
    }

    function _resolveInstantChallenge(uint256 challengeId) internal {
        InstantChallenge storage ic = instantChallenges[challengeId];
        require(ic.active, "Challenge not active");
        require(!ic.resolved, "Challenge already resolved");
        require(ic.completedCount > 0, "No completed sessions");

        address winner = address(0);
        uint256 bestTime = type(uint256).max;

        for (uint256 i = 0; i < ic.sessionIds.length; i++) {
            bytes32 sessionId = ic.sessionIds[i];
            GameSession storage gs = sessions[sessionId];
            if (!gs.completed) {
                continue;
            }
            if (gs.completionTime < bestTime) {
                bestTime = gs.completionTime;
                winner = gs.player;
            }
        }

        require(winner != address(0), "No valid winner");

        uint256 winnerAmount = (ic.totalPool * 9000) / BASIS;
        uint256 feeAmount = ic.totalPool - winnerAmount;

        ic.active = false;
        ic.resolved = true;
        ic.winner = winner;
        ic.winningTime = bestTime;

        profiles[winner].totalWinnings += winnerAmount;
        totalFeesCollected += feeAmount;
        totalPrizesDistributed += winnerAmount;

        (bool ok,) = winner.call{value: winnerAmount}("");
        require(ok, "Winner transfer failed");
        (bool feeOk,) = owner().call{value: feeAmount}("");
        require(feeOk, "Fee transfer failed");

        emit PrizePaid(winner, winnerAmount, ic.levelId);
        emit InstantChallengeResolved(challengeId, winner, bestTime, winnerAmount, feeAmount);
    }

    function finalizeInstantChallenge(uint256 challengeId) external nonReentrant whenNotPaused {
        InstantChallenge storage ic = instantChallenges[challengeId];
        require(ic.active, "Challenge not active");
        require(!ic.resolved, "Challenge already resolved");
        require(ic.completedCount > 0, "No completed sessions");
        require(block.timestamp >= ic.createdAt + 1 days, "Challenge still in progress");
        _resolveInstantChallenge(challengeId);
    }

    function joinWeeklyChallenge(uint256 levelId)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 weeklyId, bytes32 sessionId)
    {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        Level storage lv = levels[levelId];
        require(lv.active, "Level not active");
        require(msg.value >= lv.minBetTinybars, "Bet below minimum");

        uint256 activeId = activeWeeklyByLevel[levelId];
        WeeklyChallenge storage wc;
        if (activeId == 0 || !weeklyChallenges[activeId].active || block.timestamp > weeklyChallenges[activeId].endAt) {
            weeklyId = ++weeklyChallengeCounter;
            wc = weeklyChallenges[weeklyId];
            wc.id = weeklyId;
            wc.levelId = levelId;
            wc.startAt = block.timestamp;
            wc.endAt = block.timestamp + 7 days;
            wc.active = true;
            wc.paid = false;
            activeWeeklyByLevel[levelId] = weeklyId;
        } else {
            weeklyId = activeId;
            wc = weeklyChallenges[weeklyId];
        }

        require(!weeklyJoined[weeklyId][msg.sender], "Already joined weekly challenge");

        wc.totalPool += msg.value;
        wc.sessionIds.push();
        weeklyJoined[weeklyId][msg.sender] = true;

        sessionId = keccak256(abi.encodePacked(
            msg.sender,
            weeklyId,
            block.timestamp,
            block.prevrandao,
            playerSessions[msg.sender].length
        ));

        sessions[sessionId] = GameSession({
            player:         msg.sender,
            levelId:        levelId,
            betAmount:      msg.value,
            startTimestamp: block.timestamp,
            completionTime: 0,
            completed:      false,
            claimed:        false,
            coinsCollected: 0,
            expEarned:      0,
            sessionId:      sessionId,
            challengeType:  2,
            challengeId:    weeklyId
        });

        wc.sessionIds[wc.sessionIds.length - 1] = sessionId;
        playerSessions[msg.sender].push(sessionId);

        emit WeeklyChallengeJoined(weeklyId, levelId, msg.sender, msg.value);
        emit GameStarted(sessionId, msg.sender, levelId, msg.value);
    }

    function submitWeeklyResult(
        bytes32 sessionId,
        uint256 completionTime,
        uint256 coinsCollected,
        bytes calldata oracleProof
    )
        external
        nonReentrant
        whenNotPaused
    {
        GameSession storage gs = sessions[sessionId];
        require(gs.challengeType == 2, "Not weekly challenge");
        require(gs.player == msg.sender, "Not your session");
        require(!gs.completed, "Already completed");
        require(gs.startTimestamp > 0, "Session not found");

        Level storage lv = levels[gs.levelId];
        require(completionTime > 0 && completionTime <= lv.timeLimit, "Invalid time");
        require(coinsCollected <= 9999, "Invalid coin count");

        (bool valid, uint256 verifiedTime) = oracle.verifyCompletionTime(
            msg.sender, gs.levelId, completionTime, oracleProof
        );
        require(valid, "Oracle rejected: possible cheating detected");

        gs.completionTime = verifiedTime;
        gs.coinsCollected = coinsCollected;
        gs.completed = true;

        uint256 timeBonus = (lv.timeLimit - verifiedTime) * 2;
        uint256 coinBonus = coinsCollected * 5;
        uint256 expEarned = lv.expReward + coinBonus + timeBonus;
        gs.expEarned = expEarned;

        PlayerProfile storage pp = profiles[msg.sender];
        uint256 oldRank = pp.rank;
        pp.totalExp += expEarned;
        pp.gamesWon++;
        if (pp.bestTime == 0 || verifiedTime < pp.bestTime) pp.bestTime = verifiedTime;
        _updateRank(msg.sender);
        if (pp.rank != oldRank) emit RankUpdated(msg.sender, oldRank, pp.rank);

        expToken.mint(msg.sender, expEarned);
        emit ExpMinted(msg.sender, expEarned);

        WeeklyChallenge storage wc = weeklyChallenges[gs.challengeId];
        if (wc.bestPlayer == address(0) || verifiedTime < wc.bestTime) {
            wc.bestTime = verifiedTime;
            wc.bestPlayer = msg.sender;
            emit WeeklyChallengeResultUpdated(gs.challengeId, msg.sender, verifiedTime);
        }

        emit GameCompleted(sessionId, verifiedTime, expEarned);
    }

    function finalizeWeeklyChallenge(uint256 weeklyId) external nonReentrant whenNotPaused {
        WeeklyChallenge storage wc = weeklyChallenges[weeklyId];
        require(wc.active, "Weekly challenge not active");
        require(!wc.paid, "Weekly challenge already paid");
        require(block.timestamp >= wc.endAt, "Weekly challenge still in progress");
        require(wc.bestPlayer != address(0), "No winner determined");

        uint256 winnerAmount = (wc.totalPool * 9800) / BASIS;
        uint256 feeAmount = wc.totalPool - winnerAmount;

        wc.paid = true;
        wc.active = false;

        profiles[wc.bestPlayer].totalWinnings += winnerAmount;
        totalFeesCollected += feeAmount;
        totalPrizesDistributed += winnerAmount;

        (bool ok,) = wc.bestPlayer.call{value: winnerAmount}("");
        require(ok, "Winner transfer failed");
        (bool feeOk,) = owner().call{value: feeAmount}("");
        require(feeOk, "Fee transfer failed");

        emit WeeklyChallengeFinalized(weeklyId, wc.bestPlayer, winnerAmount, feeAmount);
    }

    function _updateRank(address player) internal {
        uint256 exp = profiles[player].totalExp;
        if      (exp >= 50000) profiles[player].rank = 4; // Legend
        else if (exp >= 20000) profiles[player].rank = 3; // Master
        else if (exp >=  8000) profiles[player].rank = 2; // Hero
        else if (exp >=  2000) profiles[player].rank = 1; // Warrior
        else                   profiles[player].rank = 0; // Novice
    }

    function isSuperRunnerActive(address player) public view returns (bool) {
        return superRunnerExpiryAt[player] > block.timestamp;
    }

    function getEggBagLimit(address player) public view returns (uint256) {
        return isSuperRunnerActive(player) ? SUPER_RUNNER_BAG_LIMIT : STANDARD_BAG_LIMIT;
    }

    function getMaxActiveIncubations(address player) public view returns (uint256) {
        return isSuperRunnerActive(player) ? SUPER_RUNNER_MAX_ACTIVE_INCUBATIONS : STANDARD_MAX_ACTIVE_INCUBATIONS;
    }

    function purchaseSuperRunnerSubscription()
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(msg.value == SUPER_RUNNER_SUBSCRIPTION_FEE_TINYBARS, "Incorrect subscription fee");

        uint256 base = superRunnerExpiryAt[msg.sender];
        uint256 startAt = base > block.timestamp ? base : block.timestamp;
        uint256 expiresAt = startAt + SUPER_RUNNER_SUBSCRIPTION_DURATION;
        superRunnerExpiryAt[msg.sender] = expiresAt;
        totalFeesCollected += msg.value;

        emit SuperRunnerSubscribed(msg.sender, expiresAt, msg.value);
    }

    // ── On-chain incubation ──────────────────────────────

    function startMaterialIncubation(bytes32 dropHash, uint256 durationSeconds)
        external
        whenNotPaused
        returns (uint256 incubationId)
    {
        return startMaterialIncubationWithRarity(dropHash, durationSeconds, RARITY_COMMON);
    }

    function startMaterialIncubationWithRarity(bytes32 dropHash, uint256 durationSeconds, uint8 rarityCode)
        public
        whenNotPaused
        returns (uint256 incubationId)
    {
        require(dropHash != bytes32(0), "Invalid drop hash");
        require(durationSeconds >= 60, "Incubation too short");
        require(durationSeconds <= 30 days, "Incubation too long");
        require(rarityCode <= RARITY_RAREST, "Invalid rarity");
        require(
            activeIncubationCount[msg.sender] < getMaxActiveIncubations(msg.sender),
            "Active incubation cap reached"
        );

        incubationId = ++materialIncubationCount[msg.sender];
        uint256 readyAt = block.timestamp + durationSeconds;

        materialIncubations[msg.sender][incubationId] = MaterialIncubation({
            id: incubationId,
            dropHash: dropHash,
            rarityCode: rarityCode,
            startAt: block.timestamp,
            readyAt: readyAt,
            durationSeconds: durationSeconds,
            claimed: false
        });
        activeIncubationCount[msg.sender] += 1;
        activeIncubationId[msg.sender] = incubationId;

        emit MaterialIncubationStarted(msg.sender, incubationId, dropHash, readyAt);
    }

    function addEggToCollector(uint256 levelId) external whenNotPaused {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        require(
            eggCollectorByLevel[msg.sender][levelId] < getEggBagLimit(msg.sender),
            "Egg bag full for level"
        );
        eggCollectorByLevel[msg.sender][levelId] += 1;
        emit EggCollectedToBag(msg.sender, levelId, eggCollectorByLevel[msg.sender][levelId]);
    }

    function incubateEggFromCollector(uint256 levelId, bytes32 dropHash, uint8 rarityCode)
        external
        whenNotPaused
        returns (uint256 incubationId)
    {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        require(dropHash != bytes32(0), "Invalid drop hash");
        require(rarityCode <= RARITY_RAREST, "Invalid rarity");
        require(eggCollectorByLevel[msg.sender][levelId] > 0, "No egg in bag for level");
        require(
            activeIncubationCount[msg.sender] < getMaxActiveIncubations(msg.sender),
            "Active incubation cap reached"
        );

        eggCollectorByLevel[msg.sender][levelId] -= 1;
        incubationId = ++materialIncubationCount[msg.sender];

        uint256 readyAt = block.timestamp + EGG_HATCH_DURATION;
        materialIncubations[msg.sender][incubationId] = MaterialIncubation({
            id: incubationId,
            dropHash: dropHash,
            rarityCode: rarityCode,
            startAt: block.timestamp,
            readyAt: readyAt,
            durationSeconds: EGG_HATCH_DURATION,
            claimed: false
        });
        activeIncubationCount[msg.sender] += 1;
        activeIncubationId[msg.sender] = incubationId;

        emit MaterialIncubationStarted(msg.sender, incubationId, dropHash, readyAt);
        emit EggIntubated(msg.sender, levelId, incubationId, readyAt);
    }

    function claimReadyMaterialIncubations(uint256[] calldata incubationIds)
        external
        whenNotPaused
        returns (bytes32[] memory claimedDropHashes)
    {
        require(incubationIds.length > 0, "No incubations provided");
        claimedDropHashes = new bytes32[](incubationIds.length);

        for (uint256 i = 0; i < incubationIds.length; i++) {
            uint256 id = incubationIds[i];
            MaterialIncubation storage inc = materialIncubations[msg.sender][id];
            require(inc.id != 0, "Incubation not found");
            require(!inc.claimed, "Already claimed");
            require(block.timestamp >= inc.readyAt, "Incubation not ready");

            inc.claimed = true;
            materialBalances[msg.sender][inc.rarityCode] += 1;
            if (activeIncubationCount[msg.sender] > 0) {
                activeIncubationCount[msg.sender] -= 1;
            }
            if (activeIncubationId[msg.sender] == id) {
                activeIncubationId[msg.sender] = 0;
            }
            claimedDropHashes[i] = inc.dropHash;
            emit MaterialIncubationClaimed(msg.sender, id, inc.dropHash);
        }
    }

    function executeMaterialTrade(uint8 routeId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        uint8 inputRarity;
        uint256 inputQty;
        uint8 outputRarity;
        uint256 outputQty;
        uint256 expectedFee;

        if (routeId == TRADE_ROUTE_SR_TO_RARE) {
            inputRarity = RARITY_RAREST;
            inputQty = 1;
            outputRarity = RARITY_RARE;
            outputQty = 3;
            expectedFee = TRADE_FEE_SR_TO_RARE_TINYBARS;
        } else if (routeId == TRADE_ROUTE_SR_TO_COMMON) {
            inputRarity = RARITY_RAREST;
            inputQty = 1;
            outputRarity = RARITY_COMMON;
            outputQty = 12;
            expectedFee = TRADE_FEE_SR_TO_COMMON_TINYBARS;
        } else {
            revert("Invalid trade route");
        }

        require(msg.value == expectedFee, "Incorrect trade fee");
        require(materialBalances[msg.sender][inputRarity] >= inputQty, "Insufficient input rarity");

        materialBalances[msg.sender][inputRarity] -= inputQty;
        materialBalances[msg.sender][outputRarity] += outputQty;
        totalFeesCollected += msg.value;

        emit MaterialTradeExecuted(
            msg.sender,
            routeId,
            inputRarity,
            inputQty,
            outputRarity,
            outputQty,
            msg.value
        );
    }

    // ── View functions ─────────────────────────────────────

    function getPlayerProfile(address player) external view returns (PlayerProfile memory) {
        return profiles[player];
    }

    function getLevelPool(uint256 levelId) external view returns (uint256) {
        return levels[levelId].totalPool;
    }

    function getPlayerSessions(address player) external view returns (bytes32[] memory) {
        return playerSessions[player];
    }

    function getLevelLeader(uint256 levelId) external view returns (address leader, uint256 bestTime) {
        return (levelLeader[levelId], levelBestTime[levelId]);
    }

    function getSession(bytes32 sessionId) external view returns (GameSession memory) {
        return sessions[sessionId];
    }

    function getMaterialIncubation(address player, uint256 incubationId)
        external
        view
        returns (MaterialIncubation memory)
    {
        return materialIncubations[player][incubationId];
    }

    function getMaterialBalance(address player, uint8 rarityCode) external view returns (uint256) {
        require(rarityCode <= RARITY_RAREST, "Invalid rarity");
        return materialBalances[player][rarityCode];
    }

    function getEggCollectorCount(address player, uint256 levelId) external view returns (uint256) {
        require(levelId >= 1 && levelId <= 10, "Invalid level");
        return eggCollectorByLevel[player][levelId];
    }

    function getSubscriptionStatus(address player)
        external
        view
        returns (
            bool active,
            uint256 expiresAt,
            uint256 bagLimit,
            uint256 maxActiveIncubations
        )
    {
        active = isSuperRunnerActive(player);
        expiresAt = superRunnerExpiryAt[player];
        bagLimit = getEggBagLimit(player);
        maxActiveIncubations = getMaxActiveIncubations(player);
    }

    function getActiveInstantChallenges(uint256 limit) external view returns (InstantChallenge[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= instantChallengeCounter; i++) {
            if (instantChallenges[i].active) activeCount++;
        }
        
        uint256 returnCount = activeCount < limit ? activeCount : limit;
        InstantChallenge[] memory result = new InstantChallenge[](returnCount);
        
        uint256 idx = 0;
        for (uint256 i = instantChallengeCounter; i >= 1 && idx < returnCount; i--) {
            if (instantChallenges[i].active) {
                result[idx] = instantChallenges[i];
                idx++;
            }
        }
        
        return result;
    }

    function getWeeklyInfo(uint256 levelId) external view returns (WeeklyChallenge memory weekly, uint256 timeLeft) {
        uint256 activeId = activeWeeklyByLevel[levelId];
        if (activeId == 0) {
            return (WeeklyChallenge(0, 0, 0, 0, address(0), 0, 0, false, false, new bytes32[](0)), 0);
        }
        
        WeeklyChallenge memory wc = weeklyChallenges[activeId];
        if (!wc.active || block.timestamp > wc.endAt) {
            return (wc, 0);
        }
        
        return (wc, wc.endAt > block.timestamp ? wc.endAt - block.timestamp : 0);
    }

    function getInstantChallenge(uint256 challengeId) external view returns (InstantChallenge memory) {
        return instantChallenges[challengeId];
    }


    function setLevelActive(uint256 levelId, bool active) external onlyOwner {
        levels[levelId].active = active;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = IGameOracle(_oracle);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok,) = owner().call{value: bal}("");
        require(ok, "Withdraw failed");
    }

    receive() external payable {}
}
