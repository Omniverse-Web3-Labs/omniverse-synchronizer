// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

enum VerifyResult {
    Success,
    PkNotMatch,
    NonceError,
    Malicious,
    Duplicated
}

struct OmniverseTokenProtocol {
    uint256 nonce;
    string chainId;
    bytes from;
    address to;
    bytes data;
    bytes signature;
}

interface IOmniverseProtocol {
    /**
     * @dev Verifies the signature of a transaction
     */
    function verifyTxSignature() external returns (VerifyResult);
}