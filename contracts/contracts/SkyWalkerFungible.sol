// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IOmniverseProtocol.sol";
import "./interfaces/IOmniverseFungible.sol";

contract SkyWalkerFungible is ERC20, Ownable, IOmniverseFungible {
    struct DelayedTx {
        bytes sender;
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

        (OmniverseTokenProtocol memory txData, uint256 timestamp) = omniverseProtocol.getTransactionData(delayedTxs[0].sender, delayedTxs[0].nonce);
        require(block.timestamp >= timestamp + omniverseProtocol.getCoolingDownTime(), "Not executable");
        delayedTxs[0] = delayedTxs[delayedTxs.length - 1];
        delayedTxs.pop();

        (uint8 op, bytes memory wrappedData) = abi.decode(txData.data, (uint8, bytes));
        if (op == APPROVE) {
            (bytes memory owner, bytes memory spender, uint256 amount) = abi.decode(wrappedData, (bytes, bytes, uint256));
            _omniverseApprove(owner, spender, amount);
        }
        else if (op == TRANSFER) {
            (bytes memory from, bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, bytes, uint256));
            _omniverseTransfer(from, to, amount);
        }
        else if (op == TRANSFER_FROM) {
            (bytes memory from, bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, bytes, uint256));
            _omniverseTransferFrom(from, to, amount);
        }
    }

    /**
     * @dev Returns the nearest exexutable delayed transaction info
     * or returns default if not found
     */
    function getExecutableDelayedTx() external view returns (DelayedTx memory ret) {
        if (delayedTxs.length > 0) {
            (, uint256 timestamp) = omniverseProtocol.getTransactionData(delayedTxs[0].sender, delayedTxs[0].nonce);
            if (block.timestamp >= timestamp + omniverseProtocol.getCoolingDownTime()) {
                ret = delayedTxs[0];
            }
        }
    }

    /**
     * @dev See {IOmniverseFungible-omniverseBalanceOf}
     * Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) external view override returns (uint256) {
        return omniverseBalances[_pk];
    }

    function _omniverseTransaction(OmniverseTokenProtocol memory _data) internal {
        // Check if the tx destination is correct
        require(keccak256(abi.encode(_data.to)) == keccak256(abi.encode(tokenIdentity)), "Wrong destination");

        // Check if the sender is honest
        // to be continued, we can use block list instead of `isMalicious`
        require(!omniverseProtocol.isMalicious(_data.from), "User is malicious");

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

            emit OmniverseTokenTransfer(_from, _to, _amount);
        }
    }

    function _omniverseApprove(bytes memory _owner, bytes memory _spender, uint256 _amount) internal {
        uint256 ownerBalance = omniverseBalances[_owner];
        if (ownerBalance < _amount) {
            // fail
        }
        else {
            unchecked {
                omniverseBalances[_owner] = ownerBalance - _amount;
            }
            
            address ownerAddr = pkToAddress(_owner);
            address spenderAddr = pkToAddress(_spender);
            _mint(ownerAddr, _amount);
            _approve(ownerAddr, spenderAddr, _amount);

            emit OmniverseTokenApproval(_owner, _spender, _amount);
        }
    }

    function _omniverseTransferFrom(bytes memory _from, bytes memory _to, uint256 _amount) internal {
        address fromAddr = pkToAddress(_from);
        address toAddr = pkToAddress(_to);
        _spendAllowance(fromAddr, toAddr, _amount);
        _burn(fromAddr, _amount);
        unchecked {
            omniverseBalances[_to] += _amount;
        }

        emit OmniverseTokenTransferFrom(_from, _to, _amount);
    }

    function pkToAddress(bytes memory _pk) internal pure returns (address) {
        bytes32 hash = keccak256(_pk);
        return address(uint160(uint256(hash)));
    }
}