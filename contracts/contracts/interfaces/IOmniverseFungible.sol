// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IOmniverseProtocol.sol";

uint8 constant APPROVE = 1;
uint8 constant TRANSFER = 2;
uint8 constant TRANSFER_FROM = 3;

interface IOmniverseFungible {
    /**
     * @dev Transfer omniverse tokens to a user
     */
    function omniverseTransfer(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Approve omniverse tokens for a user
     */
    function omniverseApprove(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Transfer omniverse tokens from a user to another user
     */
    function omniverseTransferFrom(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) public returns (uint256) external;
}