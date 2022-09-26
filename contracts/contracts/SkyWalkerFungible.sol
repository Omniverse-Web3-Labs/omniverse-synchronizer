// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IOmniverseProtocol.sol";
import "./interfaces/IOmniverseFungible.sol";

contract SkyWalkerFungible is ERC20, Ownable {
    struct DelayedTx {
        address sender;
        uint256 nonce;
    }

    IOmniverseProtocol public omniverseProtocol;
    string public tokenIdentity;
    mapping(string => string) members;
    mapping(bytes => uint256) omniverseBalances;
    mapping(bytes => uint256) prisons;
    DelayedTx[] delayedTxs;

    event OmniverseTokenTransfer(bytes indexed from, bytes indexed to, uint256 value);
    event OmniverseTokenApproval(bytes indexed owner, bytes indexed spender, uint256 value);
    event OmniverseTokenTransferFrom(bytes indexed from, bytes indexed to, uint256 value);

    constructor(string memory _tokenId, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        tokenIdentity = _tokenId;
    }

    /**
     * @dev Set the address of the omniverse protocol
     */
    function setOmniverseProtocolAddress(address _address) public onlyOwner {
        omniverseProtocol = IOmniverseProtocol(_address);
    }

    /**
     * @dev See {IOmniverseFungible-omniverseTransfer}
     * Transfer omniverse tokens to a user
     */
    function omniverseTransfer(OmniverseTokenProtocol calldata _data) external override {
        _omniverseTransaction(_data);
    }

    /**
     * @dev See {IOmniverseFungible-omniverseApprove}
     * Approve omniverse tokens for a user
     */
    function omniverseApprove(OmniverseTokenProtocol calldata _data) external override {
        _omniverseTransaction(_data);
    }

    /**
     * @dev See {IOmniverseFungible-omniverseTransferFrom}
     * Transfer omniverse tokens from a user to another user
     */
    function omniverseTransferFrom(OmniverseTokenProtocol calldata _data) external override {
        _omniverseTransaction(_data);
    }

    /**
     * @dev Trigger the execution of the first delayed transaction
     */
    function triggerExecution() external {
        require(delayedTxs.length > 0, "No delayed tx");

        DelayedTx storage delayedTx = delayedTxs[0];
        (OmniverseTokenProtocol memory txData, uint256 timestamp) = omniverseProtocol.getTransactionData(delayedTx[0].sender, delayedTx[0].nonce);
        require(block.timestamp >= timestamp + omniverseProtocol.cdTime, "Not executable");
        delayedTxs[0] = delayedTxs[delayedTxs.length - 1];
        delayedTxs.pop();

        (uint8 op, bytes memory wrappedData) = abi.decode(txData.data, (uint8, bytes));
        if (op == APPROVE) {
            (address owner, address spender, uint256 amount) = abi.decode(wrappedData, (address, address, uint256));
            _omniverseApprove(owner, spender, amount);
        }
        else if (op == TRANSFER) {
            (address from, address to, uint256 amount) = abi.decode(wrappedData, (address, address, uint256));
            _omniverseTransfer(from, to, amount);
        }
        else if (op == TRANSFER_FROM) {
            (address from, address to, uint256 amount) = abi.decode(wrappedData, (address, address, uint256));
            _omniverseTransferFrom(from, to, amount);
        }
    }

    /**
     * @dev Returns the nearest exexutable delayed transaction info
     * or returns default if not found
     */
    function getExecutableDelayedTx() external returns (DelayedTx memory ret) {
        if (delayedTxs.length > 0) {
            (OmniverseTokenProtocol memory txData, uint256 timestamp) = omniverseProtocol.getTransactionData(delayedTx[0].sender, delayedTx[0].nonce);
            if (block.timestamp >= timestamp + omniverseProtocol.cdTime) {
                ret = delayedTxs[0];
            }
        }
    }

    /**
     * @dev See {IOmniverseFungible-omniverseBalanceOf}
     * Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) external override returns (uint256) {
        return omniverseBalances[_pk];
    }

    function _omniverseTransaction(OmniverseTokenProtocol memory _data) internal {
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
            _mint(_owner, _amount);
            _approve(_owner, _spender, _amount);

            emit OmniverseTokenApproval(_owner, _spender, _amount);
        }
    }

    function _omniverseTransferFrom(address _from, address _to, uint256 _amount) internal {
        _spendAllowance(_from, _to, _amount);
        _burn(_from, _amount);
        unchecked {
            omniverseBalances[_to] += _amount;
        }

        emit OmniverseTokenTransferFrom(_from, _to, _amount);
    }
}