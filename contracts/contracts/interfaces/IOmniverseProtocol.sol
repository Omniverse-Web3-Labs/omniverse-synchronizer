// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

enum VerifyResult {
    Success,
    Malicious
}

struct OmniverseTokenProtocol {
    uint256 nonce;
    uint8 chainId;
    bytes from;
    string to;
    Payload data;
    bytes signature;
}

enum MsgType {
    EvmString,
    EvmU8,
    EvmU16,
    EvmU32,
    EvmU64,
    EvmU128,
    EvmI8,
    EvmI16,
    EvmI32,
    EvmI64,
    EvmI128,
    EvmStringArray,
    Bytes,
    EvmU16Array,
    EvmU32Array,
    EvmU64Array,
    EvmU128Array,
    EvmI8Array,
    EvmI16Array,
    EvmI32Array,
    EvmI64Array,
    EvmI128Array,
    EvmAddress
}

struct PayloadItem {
    string name;
    MsgType msgType;
    bytes value;
}

struct Payload {
    PayloadItem[] items;
}

interface IOmniverseProtocol {
    event TransactionSent(bytes pk, uint256 nonce);

    /**
     * @dev Verifies the signature of a transaction
     */
    function verifyTransaction(OmniverseTokenProtocol calldata _data) external returns (VerifyResult);

    /**
     * @dev Returns the count of transactions
     */
    function getTransactionCount(bytes memory _pk) external view returns (uint256);
    
    /**
     * @dev Index the user is malicious or not
     */
    function isMalicious(bytes memory _pk) external view returns (bool);

    /**
     * @dev Returns the transaction data of the user with a specified nonce
     */
    function getTransactionData(bytes calldata _user, uint256 _nonce) external view returns (OmniverseTokenProtocol memory txData, uint256 timestamp);

    /**
     * @dev Returns the cooling down time
     */
    function getCoolingDownTime() external view returns (uint256);

    /**
     * @dev Returns the chain ID
     */
    function getChainId() external view returns (uint8);
}