// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ExpToken is ERC20, Ownable {

    address public gameContract;

    event GameContractUpdated(address indexed newContract);

    constructor() ERC20("ChainRun EXP", "CREXP") Ownable(msg.sender) {}

    modifier onlyGame() {
        require(msg.sender == gameContract || msg.sender == owner(), "Not authorized");
        _;
    }

    function setGameContract(address _game) external onlyOwner {
        gameContract = _game;
        emit GameContractUpdated(_game);
    }

    function mint(address to, uint256 amount) external onlyGame {
        _mint(to, amount * 1e18);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function getRank(address player) external view returns (string memory) {
        uint256 exp = balanceOf(player) / 1e18;
        if (exp >= 50000) return "Legend";
        if (exp >= 20000) return "Master";
        if (exp >=  8000) return "Hero";
        if (exp >=  2000) return "Warrior";
        return "Novice";
    }
}