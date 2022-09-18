// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./interfaces/IOmniverseProtocol";

contract OmniverseProtocol is IOmniverseProtocol {
    struct OmniverseTx {
        OmniverseTokenProtocol txData;
        uint256 timestamp;
    }

    struct EvilTxData {
        OmniverseTx txData;
        uint256 hisNonce;
    }

    struct RecordedCertificate {
        uint256 nonce;
        address evmAddress;
        OmniverseTx[] txList;
        EvilTxData[] evilTxList;
    }

    string public chainId;
    mapping(bytes => RecordedCertificate) transactionRecorder;

    /**
     * @dev See IOmniverseProtocl
     */
    function verifyTxSignature(OmniverseTokenProtocol calldata _data) external override returns (bool) {
        RecordedCertificate storage rc = transactionRecorder[_data.from];
        // Check nonce
        if (rc.nonce == _data.nonce) {
            bytes32 hash = getTransactionHash(_data);
        }
        else if (rc.nonce > _data.nonce) {

        }
        else {
            return false;
        }
    }

    /**
     * @dev Get the hash of a tx
     */
    function getTransactionHash(OmniverseTokenProtocol calldata _data) internal returns (bytes32) {
        bytes memory rawData = abi.encodePacked(uint128(_data.nonce), _data.chainId, _data.from, _data.to, _data.data);
        return keccak256(rawData);
    }

    /**
     * @dev Recover the address
     */
    function recoverAddress(bytes32 _hash, bytes memory _signature) internal returns (address) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := mload(add(_signature, 65))
        }
        return ecrecover(_hash, v, r, s);
    }
}