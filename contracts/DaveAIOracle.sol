// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DaveAIOracle is Ownable {

    address public aiAgentSigner;
    uint256 public constant PROOF_VALIDITY_WINDOW = 5 minutes;

    struct VerificationResult {
        address player;
        uint256 levelId;
        uint256 verifiedTime;
        bool passed;
        string reason;
        uint256 timestamp;
    }

    mapping(bytes32 => VerificationResult) public results;
    mapping(address => uint256) public playerFailCount;

    event VerificationPassed(address indexed player, uint256 levelId, uint256 time);
    event VerificationFailed(address indexed player, uint256 levelId, string reason);

    constructor(address _signer) Ownable(msg.sender) {
        aiAgentSigner = _signer;
    }

    function verifyCompletionTime(
        address player,
        uint256 levelId,
        uint256 claimedTime,
        bytes calldata oracleProof
    ) external returns (bool valid, uint256 verifiedTime) {

        (
            uint256 agentTime,
            bytes memory sig,
            uint256 timestamp,
            bytes32 inputHash
        ) = abi.decode(oracleProof, (uint256, bytes, uint256, bytes32));

        require(block.timestamp - timestamp <= PROOF_VALIDITY_WINDOW, "Proof expired");

        bytes32 msgHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(player, levelId, agentTime, inputHash, timestamp))
        ));

        address recovered = _recover(msgHash, sig);

        if (recovered != aiAgentSigner) {
            emit VerificationFailed(player, levelId, "Invalid signature");
            playerFailCount[player]++;
            return (false, 0);
        }

        if (agentTime != claimedTime) {
            emit VerificationFailed(player, levelId, "Time mismatch");
            return (false, 0);
        }

        emit VerificationPassed(player, levelId, agentTime);
        return (true, agentTime);
    }

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return ecrecover(hash, v, r, s);
    }

    function setSigner(address _signer) external onlyOwner {
        aiAgentSigner = _signer;
    }
}