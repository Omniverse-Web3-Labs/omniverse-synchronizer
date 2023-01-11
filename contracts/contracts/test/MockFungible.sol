// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../SkywalkerFungible.sol";

contract MockFungible is SkywalkerFungible {
    constructor(uint8 _chainId, string memory _tokenId, string memory _name, string memory _symbol) SkywalkerFungible(_chainId, _tokenId, _name, _symbol) {

    }

    function verifyTransaction(OmniverseTokenProtocol memory _data) external returns (VerifyResult) {
        return _verifyTransaction(_data);
    }
}