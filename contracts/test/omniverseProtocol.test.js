const utils = require('./utils');
const BN = require('bn.js');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const Web3 = require('web3');
const web3js = new Web3(Web3.givenProvider);
const assert = require('assert');

const CHAIN_ID = 0;
const CHAIN_ID_OTHER = 1;
const ONE_TOKEN = '1000000000000000000';
const TEN_TOKEN = '10000000000000000000';
const HUNDRED_TOKEN = '100000000000000000000';
const TOKEN_ID = 'skywalker';
const COOL_DOWN = 2;

const DEPOSIT = 0;
const TRANSFER = 1;
const WITHDRAW = 2;
const MINT = 3;

const OmniverseProtocol = artifacts.require('./OmniverseProtocol.sol');
const Locker = artifacts.require('./SkywalkerFungible.sol');
OmniverseProtocol.numberFormat = 'String';
Locker.numberFormat = 'String';

const owner = '0xe092b1fa25DF5786D151246E492Eed3d15EA4dAA';
const user1 = '0xc0d8F541Ab8B71F20c10261818F2F401e8194049';
const user2 = '0xf1F8Ef6b4D4Ba31079E2263eC85c03fD5a0802bF';
const committee = '0xc91579bB7972f76D595f8665BffaF92874C8084C';

const ownerPk = '0xb0c4ae6f28a5579cbeddbf40b2209a5296baf7a4dc818f909e801729ecb5e663dce22598685e985a6ed1a557cf2145deba5290418b3cc00680a90accc9b93522';
const user1Pk = '0x99f5789b8b0d903a6e868c5fb9971eedde37da046e69d49c903a1b33167e0f76d1f1269628bfcff54e0581a0b019502394754e900dcbb69bf30010d51967d780';
const user2Pk = '0x25607735c05d91b504425c25567154aea2fd07e9a515b7872c7f783aa58333942b9d6ac3afacdccfe2585d1a4617f23a802a32bb6abafe13aaba2d386d44f52d';
const committeePk = '0x8bb25caae0a466afde04833610cf0c998050693974188853bdb982ed60e5e08ee71b3c9c0f900f8191512787e47908277272f71f991cb15fa364bad8018ef40b';

const ownerSk = Buffer.from('0cc0c2de7e8c30525b4ca3b9e0b9703fb29569060d403261055481df7014f7fa', 'hex');
const user1Sk = Buffer.from('b97de1848f97378ee439b37e776ffe11a2fff415b2f93dc240b2d16e9c184ba9', 'hex');
const user2Sk = Buffer.from('42f3b9b31fcaaa03ca71cab7d194979d0d1bedf16f8f4e9414f0ed4df699dd10', 'hex');
const committeeSk = Buffer.from('41219e3efe938f4b1b5bd68389705be763821460b940d5e2bd221f66f40028d3', 'hex');

let signData = (hash, sk) => {
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(sk));
    return '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
}

let getRawData = (txData) => {
    let bData = Buffer.concat([Buffer.from(new BN(txData.nonce).toString('hex').padStart(32, '0'), 'hex'), Buffer.from(new BN(txData.chainId).toString('hex').padStart(2, '0'), 'hex'),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    return bData;
}

let encodeMint = (from, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: CHAIN_ID,
        from: from.pk,
        to: TOKEN_ID,
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [MINT, transferData]),
    }
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, from.sk);
    return txData;
}

let encodeTransfer = (from, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: CHAIN_ID,
        from: from.pk,
        to: TOKEN_ID,
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    }
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, from.sk);
    return txData;
}

let encodeWithdraw = (from, amount, nonce, chainId) => {
    let transferData = web3js.eth.abi.encodeParameters(['uint256'], [amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId ? chainId : CHAIN_ID,
        from: from.pk,
        to: TOKEN_ID,
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [WITHDRAW, transferData]),
    }
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, from.sk);
    return txData;
}

let encodeDeposit = (from, toPk, amount, nonce, chainId) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId ? chainId : CHAIN_ID,
        from: from.pk,
        to: TOKEN_ID,
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [DEPOSIT, transferData]),
    }
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, from.sk);
    return txData;
}

contract('OmniverseProtocol', function() {
    let protocol;
    let locker;

    let initContract = async function() {
        protocol = await OmniverseProtocol.new(CHAIN_ID);
        locker = await Locker.new(TOKEN_ID, TOKEN_ID, TOKEN_ID);
        await locker.setOmniverseProtocolAddress(protocol.address);
        await protocol.setCooingDownTime(COOL_DOWN);
    }
    
    describe('Verify transaction', function() {
        before(async function() {
            await initContract();
        });

        describe('Signature error', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                txData.signature = txData.signature.slice(0, -2);
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Signature verifying failed');
            });
        });

        describe('Sender not signer', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                txData.from = ownerPk;
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Sender not signer');
            });
        });

        describe('Nonce error', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk) + 20;
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Nonce error');
            });
        });

        describe('All conditions satisfied', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                let ret = await protocol.verifyTransaction(txData);
                let count = await protocol.getTransactionCount(user1Pk);
                assert(count == 1, "The count should be one");
                assert(ret.logs[0].event == 'TransactionSent');
            });
        });

        describe('Cooling down', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction cooling down');
            });
        });

        describe('Transaction duplicated', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk) - 1;
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction duplicated');
            });
        });

        describe('Malicious', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk) - 1;
                let txData = encodeMint({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await protocol.verifyTransaction(txData);
                let malicious = await protocol.isMalicious(user1Pk);
                assert(malicious, "It should be malicious");
            });
        });

        describe('Cooled down', function() {
            it('should succeed', async () => {
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                let ret = await protocol.verifyTransaction(txData);
                let count = await protocol.getTransactionCount(user1Pk);
                assert(count == 2);
                assert(ret.logs[0].event == 'TransactionSent');
            });
        });
    });
});
    
contract('SkywalkerFungible', function() {
    before(async function() {
        await initContract();
    });

    let protocol;
    let locker;

    let initContract = async function() {
        protocol = await OmniverseProtocol.new(CHAIN_ID, {from: owner});
        locker = await Locker.new(TOKEN_ID, TOKEN_ID, TOKEN_ID, {from: owner});
        await locker.setOmniverseProtocolAddress(protocol.address);
        await protocol.setCooingDownTime(COOL_DOWN);
        await locker.setCommitteeAddress(committeePk);
    }

    const mintToken = async function(from, toPk, amount) {
        let nonce = await protocol.getTransactionCount(from.pk);
        let txData = encodeMint(from, toPk, amount, nonce);
        await locker.omniverseMint(txData);
        await utils.sleep(COOL_DOWN);
        await utils.evmMine(1);
        let ret = await locker.triggerExecution();
    }
    
    describe('Omniverse Transaction', function() {
        before(async function() {
            await initContract();
        });
    
        describe('Wrong destination', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                txData.to = 'LandRover';
                let bData = getRawData(txData);
                let hash = keccak256(bData);
                txData.signature = signData(hash, user1Sk);
                await utils.expectThrow(locker.omniverseTransfer(txData), 'Wrong destination');
            });
        });
    
        describe('All conditions satisfied', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                let count = await locker.getDelayedTxCount();
                assert(count == 1, 'The number of delayed txs should be one');
            });
        });
    
        describe('Malicious transaction', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk) - 1;
                let txData = encodeMint({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await locker.omniverseMint(txData);
                let count = await locker.getDelayedTxCount();
                assert(count == 1, 'The number of delayed txs should be one');
            });
        });
    
        describe('User is malicious', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await utils.expectThrow(locker.omniverseTransfer(txData), 'User is malicious');
            });
        });
    });
    
    describe('Get executable delayed transaction', function() {
        before(async function() {
            await initContract();
            let nonce = await protocol.getTransactionCount(user1Pk);
            let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
            await locker.omniverseTransfer(txData);
        });

        describe('Cooling down', function() {
            it('should be none', async () => {
                let tx = await locker.getExecutableDelayedTx();
                assert(tx.sender == '0x', 'There should be no transaction');
            });
        });

        describe('Cooled down', function() {
            it('should be one transaction', async () => {
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let tx = await locker.getExecutableDelayedTx();
                assert(tx.sender == user1Pk, 'There should be one transaction');
            });
        });
    });
    
    describe('Trigger execution', function() {
        before(async function() {
            await initContract();
        });

        describe('No delayed transaction', function() {
            it('should fail', async () => {
                await utils.expectThrow(locker.triggerExecution(), 'No delayed tx');
            });
        });

        describe('Not executable', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                await utils.expectThrow(locker.triggerExecution(), 'Not executable');
            });
        });
    });
    
    describe('Mint', function() {
        before(async function() {
            await initContract();
        });

        describe('Not owner', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeMint({pk: user2Pk, sk: user2Sk}, user1Pk, ONE_TOKEN, nonce);
                await locker.omniverseMint(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseNotOwner');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
            });
        });

        describe('Is owner', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeMint({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN, nonce);
                await locker.omniverseMint(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                let o = await locker.owner();
                assert(ret.logs[0].event == 'OmniverseTokenTransfer');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });
    });
    
    describe('Transfer', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
        });

        describe('Exceed balance', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
                balance = await locker.omniverseBalanceOf(user2Pk);
                assert('0' == balance, 'Balance should be zero');
            });
        });

        describe('Balance enough', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, ONE_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenTransfer');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(user2Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });
    });
    
    describe('Withdraw', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
        });

        describe('Exceed balance', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, TEN_TOKEN, nonce);
                await locker.omniverseWithdraw(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });

        describe('Balance enough', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, ONE_TOKEN, nonce);
                await locker.omniverseWithdraw(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenWithdraw');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.balanceOf(user1);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });

        describe('Message received from other chain', function() {
            before(async function() {
                await initContract();
                await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
            });

            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(user1Pk);
                let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, ONE_TOKEN, nonce, CHAIN_ID_OTHER);
                await locker.omniverseWithdraw(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenWithdraw');
                let balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
            });
        });
    });
    
    describe('Request Deposit', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
            let nonce = await protocol.getTransactionCount(user1Pk);
            let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, ONE_TOKEN, nonce);
            await locker.omniverseWithdraw(txData);
            await utils.sleep(COOL_DOWN);
            await utils.evmMine(1);
            let ret = await locker.triggerExecution();
        });

        describe('Signer and sender not match', function() {
            it('should fail', async () => {
                await utils.expectThrow(locker.requestDeposit(user1Pk, ONE_TOKEN, {from: user2}), 'Signer and receiver not match');
            });
        });

        describe('Deposit amount exceeds balance', function() {
            it('should fail', async () => {
                await utils.expectThrow(locker.requestDeposit(user1Pk, HUNDRED_TOKEN, {from: user1}), 'Deposit amount exceeds balance');
            });
        });

        describe('All condition satisfied', function() {
            it('should succeed', async () => {
                await locker.requestDeposit(user1Pk, ONE_TOKEN, {from: user1});
                let index = await locker.depositDealingIndex();
                assert(index == 0);
                let request = await locker.getDepositRequest(index);
                assert(request.receiver == user1Pk);
                assert(request.amount == ONE_TOKEN);
                let balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
            });
        });
    });
    
    describe('Approve Deposit', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
            let nonce = await protocol.getTransactionCount(user1Pk);
            let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, ONE_TOKEN, nonce);
            await locker.omniverseWithdraw(txData);
            await utils.sleep(COOL_DOWN);
            await utils.evmMine(1);
            let ret = await locker.triggerExecution();
            await locker.requestDeposit(user1Pk, ONE_TOKEN, {from: user1});
        });

        describe('Sender not the committee', function() {
            it('should fail', async () => {
                await utils.expectThrow(locker.approveDeposit(1, 0, '0x', {from: user1}), 'Only committee can approve deposits');
            });
        });

        describe('Index is not current', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(committeePk);
                let txData = encodeDeposit({pk: committeePk, sk: committeeSk}, user1Pk, ONE_TOKEN, nonce, CHAIN_ID);
                await utils.expectThrow(locker.approveDeposit(1, txData.nonce, txData.signature, {from: committee}), 'Index is not current');
            });
        });

        describe('Index out of bound', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(committeePk);
                let txData = encodeDeposit({pk: committeePk, sk: committeeSk}, user1Pk, ONE_TOKEN, nonce, CHAIN_ID);
                await utils.expectThrow(locker.approveDeposit(1, txData.nonce, txData.signature, {from: committee}), 'error');
            });
        });

        describe('All condition satisfied', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(committeePk);
                let txData = encodeDeposit({pk: committeePk, sk: committeeSk}, user1Pk, ONE_TOKEN, nonce, CHAIN_ID);
                await locker.approveDeposit(0, txData.nonce, txData.signature, {from: committee});
            });
        });
    });
    
    describe('Deposit', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
            let nonce = await protocol.getTransactionCount(user1Pk);
            let txData = encodeWithdraw({pk: user1Pk, sk: user1Sk}, ONE_TOKEN, nonce);
            await locker.omniverseWithdraw(txData);
            await utils.sleep(COOL_DOWN);
            await utils.evmMine(1);
            let ret = await locker.triggerExecution();
            await locker.requestDeposit(user1Pk, ONE_TOKEN, {from: user1});
        });

        describe('All conditions satisfied', function() {
            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(committeePk);
                let txData = encodeDeposit({pk: committeePk, sk: committeeSk}, user1Pk, ONE_TOKEN, nonce, CHAIN_ID);
                await locker.approveDeposit(0, txData.nonce, txData.signature, {from: committee});
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenDeposit');
                let balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(user1Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });

        describe('Message received from other chain', function() {
            before(async function() {
                await initContract();
            });

            it('should succeed', async () => {
                let nonce = await protocol.getTransactionCount(committeePk);
                let txData = encodeDeposit({pk: committeePk, sk: committeeSk}, user1Pk, ONE_TOKEN, nonce, CHAIN_ID_OTHER);
                await locker.omniverseDeposit(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseTokenDeposit');
                let balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(user1Pk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });
    });
});