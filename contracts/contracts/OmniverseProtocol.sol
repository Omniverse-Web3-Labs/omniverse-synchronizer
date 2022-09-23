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
    uint256 public cdTime;
    mapping(bytes => RecordedCertificate) transactionRecorder;

    /**
     * @dev See IOmniverseProtocl
     */
    function verifyTransaction(OmniverseTokenProtocol calldata _data) external override returns (VerifyResult) {
        RecordedCertificate storage rc = transactionRecorder[_data.from];
        uint256 nonce = getTransactionCount(_data.from) + 1;
        
        bytes32 txHash = _getTransactionHash(_data);
        address recoveredAddress = _recoverAddress(txHash, data.signature);
        // Signature verified failed
        _checkPkMatched(_data.from, recoveredAddress);

        // Check nonce
        if (nonce == _data.nonce) {
            uint256 lastestTxTime = 0;
            if (rc.txList.length > 0) {
                lastestTxTime = rc.txList[rc.txList.length - 1].timestamp;
            }
            require(block.timestamp >= lastestTxTime + cdTime, "Transaction cooling down");
            // Add to transaction recorder
            OmniverseTx storage omniTx = rc.txList.push();
            omniTx.timestamp = block.timestamp;
            omniTx.txData = _data;
        }
        else if (nonce > _data.nonce) {
            // The message has been received, check conflicts
            OmniverseTx storage hisTx = rc.txList[_data.nonce];
            bytes32 hisTxHash = _getTransactionHash(hisTx.txData);
            if (hisTxHash != txHash) {
                // to be continued, add to evil list, but can not be duplicated
                // EvilTxData storage evilTx = evilTxList.
                return VerifyResult.Malicious;
            }
            else {
                revert("Transaction duplicated");
            }
        }
        else {
            revert("Nonce error");
        }
        return VerifyResult.Success;
    }

    /**
     * @dev See IOmniverseProtocl
     */
    function getTransactionCount(bytes memory _pk) external returns (uint256) {
        return transactionRecorder[_publicKey].txList.length;
    }

    /**
     * @dev Returns the transaction data of the user with a specified nonce
     */
    function getTransactionData(address _user, uint256 _nonce) external returns (OmniverseTokenProtocol memory txData, uint256 timestamp) {
        
    }

    /**
     * @dev Get the hash of a tx
     */
    function _getTransactionHash(OmniverseTokenProtocol calldata _data) internal returns (bytes32) {
        bytes memory rawData = abi.encodePacked(uint128(_data.nonce), _data.chainId, _data.from, _data.to, _data.data);
        return keccak256(rawData);
    }

    /**
     * @dev Recover the address
     */
    function _recoverAddress(bytes32 _hash, bytes memory _signature) internal returns (address) {
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
    function _checkPkMatched(bytes _publicKey, address _address) internal {
        bytes32 hash = keccak256(_publicKey);
        address pkAddress = address(uint160(bytes20(hash)));
        require(_address == pkAddress, "Signature verifying failed");
    }

    /**
     * @dev See IOmniverseProtocl
     */
    function isMalicious(bytes memory _pk) external returns (bool) {
        RecordedCertificate storage rc = transactionRecorder[_pk];
        return (rc.evilTxList.length > 0);
    }
}