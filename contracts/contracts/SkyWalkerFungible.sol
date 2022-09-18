// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IOmniverseProtocol";

contract SkyWalkerFungible is ERC20, Ownable {
    mapping(string => string) members;
    mapping(bytes => uint256) omniverseBalances;
    mapping(bytes => uint256) prisons;
    mapping(bytes => uint256) pending;

    /**
     * @dev Transfer omniverse tokens to a user
     */
    function omniverseTransfer(OmniverseTokenProtocol calldata _data) public {

    }

    /**
     * @dev Approve omniverse tokens for a user
     */
    function omniverseApprove(OmniverseTokenProtocol calldata _data) public {
    }

    /**
     * @dev Transfer omniverse tokens from a user to another user
     */
    function omniverseTransferFrom(OmniverseTokenProtocol calldata _data) public {
    }

    /**
     * @dev Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) public returns (uint256) {
        return omniverseBalances[_pk];
    }
}