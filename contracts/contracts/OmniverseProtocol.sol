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
        // uint256 nonce;
        // address evmAddress;
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
        uint256 nonce = getTransactionCount(_data.from) + 1;
        
        bytes32 txHash = getTransactionHash(_data);
        address recoveredAddress = recoverAddress(txHash, data.signature);
        // Signature verified failed
        if (!isPkMatched(_data.from, recoveredAddress)) {
            return false;
        }

        // Check nonce
        if (nonce == _data.nonce) {
            // Add to transaction recorder
            OmniverseTx storage omniTx = rc.txList.push();
            omniTx.timestamp = block.timestamp;
            omniTx.txData = _data;
        }
        else if (nonce > _data.nonce) {
            // The message has been received, check conflicts
            OmniverseTx storage hisTx = rc.txList[_data.nonce];
            bytes32 hisTxHash = getTransactionHash(hisTx.txData);
            if (hisTxHash != txHash) {
                // to be continued, add to evil list, but can not be duplicated
                // EvilTxData storage evilTx = evilTxList.
                return false;
            }
        }
        else {
            return false;
        }
        return false;
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

    /**
     * @dev Check if the public key matches the recovered address
     */
    function isPkMatched(bytes _publicKey, address _address) internal returns (bool) {
        bytes32 hash = keccak256(_publicKey);
        address pkAddress = address(uint160(bytes20(hash)));
        return (_address == pkAddress);
    }

    /**
     * @dev Returns the count of transactions
     */
    function getTransactionCount(bytes _publicKey) public returns (uint256) {
        return transactionRecorder[_publicKey].txList.length;
    }
}