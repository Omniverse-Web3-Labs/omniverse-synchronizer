// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC20.sol";
import "./OmniverseProtocol.sol";
import "./interfaces/IOmniverseFungible.sol";

contract SkywalkerFungible is ERC20, Ownable, IOmniverseFungible {
    struct DelayedTx {
        bytes sender;
        uint256 nonce;
    }

    uint8 public chainId;
    uint256 public cdTime;
    mapping(bytes => RecordedCertificate) transactionRecorder;
    mapping(bytes => OmniverseTx) transactionCache;

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
    event OmniverseTokenWrongOp(bytes sender, uint8 op);
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

        OmniverseTx storage cache = transactionCache[delayedTxs[0].sender];
        require(cache.timestamp != 0, "Not cached");
        require(cache.txData.nonce == delayedTxs[0].nonce, "Nonce error");
        (OmniverseTokenProtocol storage txData, uint256 timestamp) = (cache.txData, cache.timestamp);
        require(block.timestamp >= timestamp + cdTime, "Not executable");
        delayedTxs[0] = delayedTxs[delayedTxs.length - 1];
        delayedTxs.pop();
        cache.timestamp = 0;
        // Add to transaction recorder
        RecordedCertificate storage rc = transactionRecorder[txData.from];
        rc.txList.push(cache);
        if (txData.chainId == chainId) {
            emit TransactionSent(txData.from, txData.nonce);
        }

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
            require(fromAddr == owner(), "Not Owner");
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            _omniverseMint(to, amount);
        }
        else {
            emit OmniverseTokenWrongOp(txData.from, op);
        }
    }
    
    /**
     * @dev Trigger the execution of the first delayed transaction
     */
    function _checkExecution(OmniverseTokenProtocol memory txData) internal view {
        (uint8 op, bytes memory wrappedData) = abi.decode(txData.data, (uint8, bytes));
        if (op == WITHDRAW) {
            (uint256 amount) = abi.decode(wrappedData, (uint256));
            _checkOmniverseWithdraw(txData.from, amount);
        }
        else if (op == TRANSFER) {
            (, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            _checkOmniverseTransfer(txData.from, amount);
        }
        else if (op == DEPOSIT) {
        }
        else if (op == MINT) {
            address fromAddr = _pkToAddress(txData.from);
            require(fromAddr == owner(), "Not owner");
        }
        else {
            revert("OP code error");
        }
    }

    /**
     * @dev Returns the nearest exexutable delayed transaction info
     * or returns default if not found
     */
    function getExecutableDelayedTx() external view returns (DelayedTx memory ret) {
        if (delayedTxs.length > 0) {
            OmniverseTx storage cache = transactionCache[delayedTxs[0].sender];
            if (block.timestamp >= cache.timestamp + cdTime) {
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
        VerifyResult verifyRet = OmniverseProtocol.verifyTransaction(transactionRecorder[_data.from], _data);

        if (verifyRet == VerifyResult.Success) {
            // Check cache
            OmniverseTx storage cache = transactionCache[_data.from];
            require(cache.timestamp == 0, "Transaction cached");
            // Logic verification
            _checkExecution(_data);
            // Delays in executing
            cache.txData = _data;
            cache.timestamp = block.timestamp;
            delayedTxs.push(DelayedTx(_data.from, _data.nonce));
        }
        else if (verifyRet == VerifyResult.Malicious) {
            // Slash
        }
    }

    function _checkOmniverseTransfer(bytes memory _from, uint256 _amount) internal view {
        uint256 fromBalance = omniverseBalances[_from];
        require(fromBalance >= _amount, "Exceed Balance");
    }

    function _omniverseTransfer(bytes memory _from, bytes memory _to, uint256 _amount) internal {
        _checkOmniverseTransfer(_from, _amount);
        
        uint256 fromBalance = omniverseBalances[_from];
        
        unchecked {
            omniverseBalances[_from] = fromBalance - _amount;
        }
        omniverseBalances[_to] += _amount;

        emit OmniverseTokenTransfer(_from, _to, _amount);

        address toAddr = _pkToAddress(_to);
        accountsMap[toAddr] = _to;
    }

    function _checkOmniverseWithdraw(bytes memory _from, uint256 _amount) internal view {
        uint256 fromBalance = omniverseBalances[_from];
        require(fromBalance >= _amount, "Exceed Balance");
    }

    function _omniverseWithdraw(bytes memory _from, uint256 _amount, bool _thisChain) internal {
        _checkOmniverseWithdraw(_from, _amount);

        uint256 fromBalance = omniverseBalances[_from];
        
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