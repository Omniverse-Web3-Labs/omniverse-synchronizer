// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "../OmniverseData.sol";

struct DepositRequest {
    bytes receiver;
    uint256 amount;
}

interface IOmniverseFungible {
    /**
     * @dev Send an omniverse transaction
     */
    function sendOmniverseTransaction(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) external view returns (uint256);
}