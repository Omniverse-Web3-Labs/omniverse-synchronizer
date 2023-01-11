// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC20.sol";
import "./OmniverseProtocol.sol";
import "./interfaces/IOmniverseFungible.sol";

contract SkywalkerFungible is ERC20, Ownable, IOmniverseFungible {
    enum VerifyResult {
        Success,
        Malicious
    }

    struct DelayedTx {
        bytes sender;
        uint256 nonce;
    }
    
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

    uint8 public chainId;
    uint256 public cdTime;
    mapping(bytes => RecordedCertificate) transactionRecorder;

    string public tokenIdentity;
    uint8[] members;
    mapping(bytes => uint256) omniverseBalances;
    mapping(bytes => uint256) prisons;
    DelayedTx[] delayedTxs;
    bytes public committee;
    DepositRequest[] depositRequests;
    uint256 public depositDealingIndex;
    mapping(address => bytes) accountsMap;

    event OmniverseTokenTransfer(bytes from, bytes to, uint256 value);
    event OmniverseTokenWithdraw(bytes from, uint256 value);
    event OmniverseTokenDeposit(bytes to, uint256 value);
    event OmniverseTokenExceedBalance(bytes owner, uint256 balance, uint256 value);
    event OmniverseTokenWrongOp(bytes sender, uint8 op);
    event OmniverseNotOwner(bytes sender);
    event OmniverseError(bytes sender, string reason);
    event TransactionSent(bytes pk, uint256 nonce);

    modifier onlyCommittee() {
        address committeeAddr = _pkToAddress(committee);
        require(msg.sender == committeeAddr, "Only committee can approve deposits");
        _;
    }

    constructor(uint8 _chainId, string memory _tokenId, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        tokenIdentity = _tokenId;
        chainId = _chainId;
    }

    /**
     * @dev Set the address of committee
     */
    function setCommitteeAddress(bytes calldata _address) public onlyOwner {
        committee = _address;
    }

    /**
     * @dev See {IOmniverseFungible-omniverseTransfer}
     * Send an omniverse transaction
     */
    function sendOmniverseTransaction(OmniverseTokenProtocol calldata _data) external override {
        _omniverseTransaction(_data);
    }

    /**
     * @dev Trigger the execution of the first delayed transaction
     */
    function triggerExecution() external {
        require(delayedTxs.length > 0, "No delayed tx");

        OmniverseTx storage omniTx = transactionRecorder[delayedTxs[0].sender].txList[delayedTxs[0].nonce];
        (OmniverseTokenProtocol storage txData, uint256 timestamp) = (omniTx.txData, omniTx.timestamp);
        require(block.timestamp >= timestamp + cdTime, "Not executable");
        delayedTxs[0] = delayedTxs[delayedTxs.length - 1];
        delayedTxs.pop();

        (uint8 op, bytes memory wrappedData) = abi.decode(txData.data, (uint8, bytes));
        if (op == WITHDRAW) {
            (uint256 amount) = abi.decode(wrappedData, (uint256));
            _omniverseWithdraw(txData.from, amount, txData.chainId == chainId);
        }
        else if (op == TRANSFER) {
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            _omniverseTransfer(txData.from, to, amount);
        }
        else if (op == DEPOSIT) {
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            _omniverseDeposit(txData.from, to, amount);
        }
        else if (op == MINT) {
            address fromAddr = _pkToAddress(txData.from);
            if (fromAddr != owner()) {
                emit OmniverseNotOwner(txData.from);
                return;
            }
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            _omniverseMint(to, amount);
        }
        else {
            emit OmniverseTokenWrongOp(txData.from, op);
        }
    }

    /**
     * @dev Returns the nearest exexutable delayed transaction info
     * or returns default if not found
     */
    function getExecutableDelayedTx() external view returns (DelayedTx memory ret) {
        if (delayedTxs.length > 0) {
            OmniverseTx storage omniTx = transactionRecorder[delayedTxs[0].sender].txList[delayedTxs[0].nonce];
            if (block.timestamp >= omniTx.timestamp + cdTime) {
                ret = delayedTxs[0];
            }
        }
    }

    function getDelayedTxCount() external view returns (uint256) {
        return delayedTxs.length;
    }

    /**
     * @dev See {IOmniverseFungible-omniverseBalanceOf}
     * Returns the omniverse balance of a user
     */
    function omniverseBalanceOf(bytes calldata _pk) external view override returns (uint256) {
        return omniverseBalances[_pk];
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual override returns (uint256) {
        bytes storage pk = accountsMap[account];
        if (pk.length == 0) {
            return 0;
        }
        else {
            return omniverseBalances[pk];
        }
    }
    
    /**
     * @dev See {Replace IERC20-balanceOf}.
     */
    function nativeBalanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function _omniverseTransaction(OmniverseTokenProtocol memory _data) internal {
        // Check if the tx destination is correct
        require(keccak256(abi.encode(_data.to)) == keccak256(abi.encode(tokenIdentity)), "Wrong destination");

        // Check if the sender is honest
        // to be continued, we can use block list instead of `isMalicious`
        require(!isMalicious(_data.from), "User is malicious");

        // Verify the signature
        VerifyResult verifyRet = _verifyTransaction(_data);
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
            emit OmniverseTokenExceedBalance(_from, fromBalance, _amount);
        }
        else {
            unchecked {
                omniverseBalances[_from] = fromBalance - _amount;
            }
            omniverseBalances[_to] += _amount;

            emit OmniverseTokenTransfer(_from, _to, _amount);

            address toAddr = _pkToAddress(_to);
            accountsMap[toAddr] = _to;
        }
    }

    function _omniverseWithdraw(bytes memory _from, uint256 _amount, bool _thisChain) internal {
        uint256 fromBalance = omniverseBalances[_from];
        if (fromBalance < _amount) {
            emit OmniverseTokenExceedBalance(_from, fromBalance, _amount);
        }
        else {
            unchecked {
                omniverseBalances[_from] = fromBalance - _amount;
            }
            
            if (_thisChain) {
                address ownerAddr = _pkToAddress(_from);

                // mint
                _totalSupply += _amount;
                _balances[ownerAddr] += _amount;
            }

            emit OmniverseTokenWithdraw(_from, _amount);
        }
    }

    function _omniverseDeposit(bytes memory _from, bytes memory _to, uint256 _amount) internal {
        require(keccak256(_from) == keccak256(committee), "Not the committee");

        unchecked {
            omniverseBalances[_to] += _amount;
        }

        emit OmniverseTokenDeposit(_to, _amount);
    }

    function _omniverseMint(bytes memory _to, uint256 _amount) internal {
        omniverseBalances[_to] += _amount;
        emit OmniverseTokenTransfer("", _to, _amount);

        address toAddr = _pkToAddress(_to);
        accountsMap[toAddr] = _to;
    }

    function _pkToAddress(bytes memory _pk) internal pure returns (address) {
        bytes32 hash = keccak256(_pk);
        return address(uint160(uint256(hash)));
    }

    function getTime() external view returns (uint256) {
        return block.timestamp;
    }

    function addMembers(uint8[] calldata _members) external onlyOwner {
        for (uint256 i = 0; i < _members.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < members.length; j++) {
                if (members[j] == _members[i]) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                members.push(_members[i]);
            }
        }
    }

    function getMembers() external view returns (uint8[] memory) {
        return members;
    }

    /**
     * @dev Users request to convert native token to omniverse token
     */
    function requestDeposit(bytes calldata from, uint256 amount) external {
        address fromAddr = _pkToAddress(from);
        require(fromAddr == msg.sender, "Signer and receiver not match");

        uint256 fromBalance = _balances[fromAddr];
        require(fromBalance >= amount, "Deposit amount exceeds balance");

        // Update
        unchecked {
            _balances[fromAddr] = fromBalance - amount;
        }
        _totalSupply -= amount;

        depositRequests.push(DepositRequest(from, amount));
    }

    /**
     * @dev The committee approves a user's request
     */
    function approveDeposit(uint256 index, uint256 nonce, bytes calldata signature) external onlyCommittee {
        require(index == depositDealingIndex, "Index is not current");

        DepositRequest storage request = depositRequests[index];
        depositDealingIndex++;

        OmniverseTokenProtocol memory p;
        p.nonce = nonce;
        p.chainId = chainId;
        p.from = committee;
        p.to = tokenIdentity;
        p.signature = signature;
        p.data = abi.encode(DEPOSIT, abi.encode(request.receiver, request.amount));
        _omniverseTransaction(p);
    }

    /**
     @dev Returns the deposit request at `index`
     @param index: The index of requests
     */
    function getDepositRequest(uint256 index) external view returns (DepositRequest memory ret) {
        if (depositRequests.length > index) {
            ret = depositRequests[index];
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return 12;
    }

    function _verifyTransaction(OmniverseTokenProtocol memory _data) internal returns (VerifyResult) {
        RecordedCertificate storage rc = transactionRecorder[_data.from];
        uint256 nonce = transactionRecorder[_data.from].txList.length;
        
        bytes32 txHash = OmniverseProtocol.getTransactionHash(_data);
        address recoveredAddress = OmniverseProtocol.recoverAddress(txHash, _data.signature);
        // Signature verified failed
        OmniverseProtocol.checkPkMatched(_data.from, recoveredAddress);

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
            if (_data.chainId == chainId) {
                emit TransactionSent(_data.from, _data.nonce);
            }
        }
        else if (nonce > _data.nonce) {
            // The message has been received, check conflicts
            OmniverseTx storage hisTx = rc.txList[_data.nonce];
            bytes32 hisTxHash = OmniverseProtocol.getTransactionHash(hisTx.txData);
            if (hisTxHash != txHash) {
                // to be continued, add to evil list, but can not be duplicated
                EvilTxData storage evilTx = rc.evilTxList.push();
                evilTx.hisNonce = nonce;
                evilTx.txData.txData = _data;
                evilTx.txData.timestamp = block.timestamp;
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
    function getTransactionCount(bytes memory _pk) external view returns (uint256) {
        return transactionRecorder[_pk].txList.length;
    }

    /**
     * @dev Returns the transaction data of the user with a specified nonce
     */
    function getTransactionData(bytes calldata _user, uint256 _nonce) external view returns (OmniverseTokenProtocol memory txData, uint256 timestamp) {
        RecordedCertificate storage rc = transactionRecorder[_user];
        OmniverseTx storage omniTx = rc.txList[_nonce];
        txData = omniTx.txData;
        timestamp = omniTx.timestamp;
    }

    function setCooingDownTime(uint256 _time) external {
        cdTime = _time;
    }

    /**
     * @dev See IOmniverseFungible
     */
    function isMalicious(bytes memory _pk) public view returns (bool) {
        RecordedCertificate storage rc = transactionRecorder[_pk];
        return (rc.evilTxList.length > 0);
    }
}