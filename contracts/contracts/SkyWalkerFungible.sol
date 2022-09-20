// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IOmniverseProtocol";

contract SkyWalkerFungible is ERC20, Ownable {
    struct DelayedTx {
        bytes pk;
        uint256 nonce;
    }

    IOmniverseProtocol public omniverseProtocol;
    string public tokenIdentity;
    mapping(string => string) members;
    mapping(bytes => uint256) omniverseBalances;
    mapping(bytes => uint256) prisons;
    DelayedTx[] delayedTxs;

    event OmniverseTokenTransfer(bytes indexed from, bytes indexed to, uint256 value);
    event OmniverseTokenApproved(bytes indexed owner, bytes indexed spender, uint256 value);

    constructor(string memory _tokenId, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        tokenIdentity = _tokenId;
    }

    /**
     * @dev Transfer omniverse tokens to a user
     */
    function omniverseTransfer(OmniverseTokenProtocol calldata _data) public {
        // Check if the tx destination is correct
        require(_data.to == tokenIdentity, "Wrong destination");

        // Check if the sender is honest
        // to be continued, we can use block list instead of `isMalicious`
        require(!omniverseProtocol.isMalicious(), "User is malicious");

        // Verify the signature
        VerifyResult verifyRet = omniverseProtocol.verifyTransaction(_data);
        if (verifyRet == VerifyResult.Success) {
            // Delays in executing
            delayedTxs.push(DelayedTx(_data.from, _data.nonce));
        }
        else if (verifyRet == VerifyResult.Malicious) {
            // Slash
        }
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

    function _omniverseTransfer(bytes memory _from, bytes memory _to, uint256 _amount) internal {
        uint256 fromBalance = omniverseBalances[_from];
        if (fromBalance < _amount) {
            // fail
        }
        else {
            unchecked {
                omniverseBalances[_from] = fromBalance - _amount;
            }
            omniverseBalances[_to] += _amount;

            emit OmniverseTokenTransfer(_from, _to, amount);
        }
    }

    function _omniverseApprove(address _owner, address _spender, uint256 _amount) internal {
        uint256 ownerBalance = omniverseBalances[_owner];
        if (ownerBalance < _amount) {
            // fail
        }
        else {
            unchecked {
                omniverseBalances[_owner] = ownerBalance - _amount;
            }
            _mint(_spender, _amount);

            emit OmniverseTokenApproved(_owner, _spender, _amount);
        }
    }

    function _omniverseTransferFrom(bytes storage _data) internal {
        // _burn()
    }

    /**
     * @dev Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) public returns (uint256) {
        return omniverseBalances[_pk];
    }

    /**
     * @dev Set the address of the omniverse protocol
     */
    function setOmniverseProtocolAddress(address _address) public onlyOwner {
        omniverseProtocol = IOmniverseProtocol(_address);
    }

    /**
     * Returns the omniverse token balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) public returns (uint256) {

    }
}