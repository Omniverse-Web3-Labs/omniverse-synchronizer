// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

enum VerifyResult {
    Success,
    Malicious,
}

struct OmniverseTokenProtocol {
    uint256 nonce;
    string chainId;
    bytes from;
    string to;
    bytes data;
    bytes signature;
}

interface IOmniverseProtocol {
    /**
     * @dev Verifies the signature of a transaction
     */
    function verifyTransaction(OmniverseTokenProtocol calldata _data) external returns (VerifyResult);

    /**
     * @dev Returns the count of transactions
     */
    function getTransactionCount(bytes memory _pk) external returns (uint256);
    
    /**
     * @dev Index the user is malicious or not
     */
    function isMalicious(bytes memory _pk) external returns (bool);
}