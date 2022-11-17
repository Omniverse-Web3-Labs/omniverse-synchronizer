// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IOmniverseProtocol.sol";

uint8 constant DEPOSIT = 0;
uint8 constant TRANSFER = 1;
uint8 constant WITHDRAW = 2;
uint8 constant MINT = 3;

struct DepositRequest {
    bytes receiver;
    uint256 amount;
}

interface IOmniverseFungible {
    /**
     * @dev Transfer omniverse tokens to a user
     */
    function omniverseTransfer(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Convert omniverse token to ERC20 token
     */
    function omniverseWithdraw(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Convert ERC20 token to omniverse token
     */
    function omniverseDeposit(OmniverseTokenProtocol calldata _data) external;

    /**
     * @dev Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) external view returns (uint256);
}