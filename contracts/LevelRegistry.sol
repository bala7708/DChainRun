// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LevelRegistry is Ownable {

    struct LevelConfig {
        uint256 id;
        string  name;
        string  difficulty;
        uint256 minBetHbar;
        uint256 timeLimitSec;
        bytes32 contentHash;
        uint256 enemySpeed;
        uint256 platformGap;
        uint256 coinDensity;
        bool    active;
    }

    mapping(uint256 => LevelConfig) public levelConfigs;
    uint256 public levelCount;

    event LevelRegistered(uint256 indexed id, string name, bytes32 contentHash);
    event LevelUpdated(uint256 indexed id, bytes32 newHash);

    constructor() Ownable(msg.sender) {
        _registerDefaultLevels();
    }

    function _registerDefaultLevels() internal {
        _addLevel(1,  "Mushroom Plains",    "easy",  5,   120, 100, 80,  80,  true);
        _addLevel(2,  "Cave Crawlers",      "easy",  5,   110, 120, 100, 70,  true);
        _addLevel(3,  "Koopa Coast",        "med",   10,  100, 150, 130, 60,  true);
        _addLevel(4,  "Sky Platform",       "med",   10,  90,  180, 160, 50,  true);
        _addLevel(5,  "Fire Kingdom",       "med",   15,  85,  200, 180, 50,  true);
        _addLevel(6,  "Bullet Bill Blitz",  "hard",  20,  80,  250, 200, 40,  true);
        _addLevel(7,  "Haunted Mansion",    "hard",  20,  75,  280, 220, 35,  true);
        _addLevel(8,  "Lava Fortress",      "hard",  25,  70,  300, 240, 30,  true);
        _addLevel(9,  "Chain Chomp Ridge",  "super", 50,  60,  350, 260, 25,  true);
        _addLevel(10, "Dragoon's Nightmare", "super", 100, 50,  450, 300, 20,  true);
    }

    function _addLevel(
        uint256 id,
        string memory name,
        string memory diff,
        uint256 bet,
        uint256 time,
        uint256 speed,
        uint256 gap,
        uint256 density,
        bool active
    ) internal {
        levelConfigs[id] = LevelConfig({
            id: id,
            name: name,
            difficulty: diff,
            minBetHbar: bet,
            timeLimitSec: time,
            contentHash: keccak256(abi.encodePacked(id, name)),
            enemySpeed: speed,
            platformGap: gap,
            coinDensity: density,
            active: active
        });

        levelCount++;
        emit LevelRegistered(id, name, levelConfigs[id].contentHash);
    }

    function updateLevelHash(uint256 id, bytes32 newHash) external onlyOwner {
        levelConfigs[id].contentHash = newHash;
        emit LevelUpdated(id, newHash);
    }

    function getLevel(uint256 id) external view returns (LevelConfig memory) {
        return levelConfigs[id];
    }

    function getAllLevels() external view returns (LevelConfig[] memory) {
        LevelConfig[] memory all = new LevelConfig[](levelCount);
        for (uint256 i = 0; i < levelCount; i++) {
            all[i] = levelConfigs[i + 1];
        }
        return all;
    }
}