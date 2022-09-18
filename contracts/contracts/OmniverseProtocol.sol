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
    function verifyTxSignature() external override returns (bool) {

    }
}