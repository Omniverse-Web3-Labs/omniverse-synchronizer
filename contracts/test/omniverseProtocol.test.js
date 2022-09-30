const utils = require('./utils');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const Web3 = require('web3');
const web3js = new Web3(Web3.givenProvider);
const assert = require('assert');

const ONE_TOKEN = '1000000000000000000';
const TEN_TOKEN = '10000000000000000000';
const HUNDRED_TOKEN = '100000000000000000000';
const TOKEN_ID = 'skywalker';
const COOL_DOWN = 1;

const TRANSFER_FROM = 0;
const TRANSFER = 1;
const APPROVE = 2;
const MINT = 3;

const OmniverseTokenApproval = '0xdef0f31451edb45073f38f2b372985fe138ee585432d98d59ffd45b6097ab97e';
const OmniverseTokenTransfer = '0x1d8380031597508b7d5d3df4999b8136789b62ed932115f9eb5897e19903792e';
const OmniverseTokenTransferFrom = '0x67e3ad403202450551624c0c8b76e0de82a103bbc467062b0b3944ddb48b154e';
const OmniverseTokenExceedBalance = '0xaa7f93bbb0659f61a11b680e0590ab23205967a5bdaa928dae6372df0bb93267';

const OmniverseProtocol = artifacts.require('./OmniverseProtocol.sol');
const Locker = artifacts.require('./SkyWalkerFungible.sol');
OmniverseProtocol.numberFormat = 'String';
Locker.numberFormat = 'String';

const owner = '0xe092b1fa25DF5786D151246E492Eed3d15EA4dAA';
const user1 = '0xc0d8F541Ab8B71F20c10261818F2F401e8194049';
const user2 = '0xf1F8Ef6b4D4Ba31079E2263eC85c03fD5a0802bF';

const ownerPk = '0x03415b5f599e6efce1101f35e5bcda1fe626c211a2cd48db193f3550e3847c0e3687ff1ffcb0147d8984f0ae8e178c4f35cde7c67aa9873e27498891d839ef0b';
const user1Pk = '0x77c8fd82e2703c2b60b39b2d953345bafab600c9b1d330c36e3d259e77db01975d2c4dd7978fa2f7d834fc2ba49bec67ae41952d67600a470a9f53ce37de660a';
const user2Pk = '0xd0d16a005ebf5ac38f3d4caa6a6559747ad48351e5976eec66c3178acc60a19318448efd0a009b17b089bfdc32bf63839681957292f9575293d3760ed8181fd2';

const ownerSk = Buffer.from('0cc0c2de7e8c30525b4ca3b9e0b9703fb29569060d403261055481df7014f7fa', 'hex');
const user1Sk = Buffer.from('b97de1848f97378ee439b37e776ffe11a2fff415b2f93dc240b2d16e9c184ba9', 'hex');
const user2Sk = Buffer.from('42f3b9b31fcaaa03ca71cab7d194979d0d1bedf16f8f4e9414f0ed4df699dd10', 'hex');

let encodeMint = (from, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: 'ETHEREUM',
        from: from.pk,
        to: 'skywalker',
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [MINT, transferData]),
    }
    let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    let hash = keccak256(bData);
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(from.sk));
    txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    return txData;
}

let encodeTransfer = (from, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: 'ETHEREUM',
        from: from.pk,
        to: 'skywalker',
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    }
    let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    let hash = keccak256(bData);
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(from.sk));
    txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    return txData;
}

let encodeApprove = (from, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: 'ETHEREUM',
        from: from.pk,
        to: 'skywalker',
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [APPROVE, transferData]),
    }
    let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    let hash = keccak256(bData);
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(from.sk));
    txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    return txData;
}

let encodeTransferFrom = (spender, fromPk, toPk, amount, nonce) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'bytes', 'uint256'], [fromPk, toPk, amount]);
    let txData = {
        nonce: nonce,
        chainId: 'ETHEREUM',
        from: spender.pk,
        to: 'skywalker',
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER_FROM, transferData]),
    }
    let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    let hash = keccak256(bData);
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(spender.sk));
    txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    return txData;
}

// contract('OmniverseProtocol', function(accounts) {

//     let protocol;
//     let locker;

//     let initContract = async function() {
//         protocol = await OmniverseProtocol.new();
//         locker = await Locker.new(TOKEN_ID, TOKEN_ID, TOKEN_ID);
//         await locker.setOmniverseProtocolAddress(protocol.address);
//         await protocol.setCooingDownTime(COOL_DOWN);
//     }
    
//     describe('Verify transaction', function() {
//         before(async function() {
//             await initContract();
//         });

//         describe('Signature error', function() {
//             it('should fail', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 0,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Signature verifying failed');
//             });
//         });

//         describe('Signer not sender', function() {
//             it('should fail', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 0,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(user1Sk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Sender not signer');
//             });
//         });

//         describe('Nonce error', function() {
//             it('should succeed', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 1,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Nonce error');
//             });
//         });

//         describe('All conditions satisfied', function() {
//             it('should succeed', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 0,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await protocol.verifyTransaction(txData);
//             });

//             describe('Transaction count', function() {
//                 it('should be one', async () => {
//                     let count = await protocol.getTransactionCount(ownerPk);
//                     assert(count == 1, "The count should be one");
//                 });
//             });
//         });

//         describe('Cooling down', function() {
//             it('should fail', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 1,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction cooling down');
//             });
//         });

//         describe('Transaction duplicated', function() {
//             it('should fail', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 0,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction duplicated');
//             });
//         });

//         describe('Malicious', function() {
//             it('should fail', async () => {
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 0,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker1',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await protocol.verifyTransaction(txData);
//                 let malicious = await protocol.isMalicious(ownerPk);
//                 assert(malicious, "It should be malicious");
//             });
//         });

//         describe('Cooled down', function() {
//             it('should succeed', async () => {
//                 await utils.sleep(COOL_DOWN);
//                 await utils.evmMine(1);
//                 let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
//                 let txData = {
//                     nonce: 1,
//                     chainId: 'ETHEREUM',
//                     from: ownerPk,
//                     to: 'skywalker',
//                     data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
//                 }
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await protocol.verifyTransaction(txData);
//                 let count = await protocol.getTransactionCount(ownerPk);
//                 assert(count == 2);
//             });
//         });
//     });
// });
    
contract('SkywalkerFungible', function(accounts) {
    const owner = accounts[0];
    const user1 = accounts[1];
    const user2 = accounts[2];

    before(async function() {
        await initContract();
    });

    let protocol;
    let locker;

    let initContract = async function() {
        protocol = await OmniverseProtocol.new({from: owner});
        locker = await Locker.new(TOKEN_ID, TOKEN_ID, TOKEN_ID, {from: owner});
        await locker.setOmniverseProtocolAddress(protocol.address);
        await protocol.setCooingDownTime(COOL_DOWN);
    }

    const mintToken = async function(from, toPk, amount) {
        let nonce = await protocol.getTransactionCount(from.pk);
        let txData = encodeMint(from, toPk, amount, nonce);
        await locker.omniverseTransfer(txData);
        await utils.sleep(COOL_DOWN);
        await utils.evmMine(1);
        let ret = await locker.triggerExecution();
    }
    
    // describe('Omniverse Transaction', function() {
    //     before(async function() {
    //         await initContract();
    //     });
    
    //     describe('Wrong destination', function() {
    //         it('should fail', async () => {
    //             let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //             let txData = {
    //                 nonce: 0,
    //                 chainId: 'ETHEREUM',
    //                 from: ownerPk,
    //                 to: 'skywalker1',
    //                 data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
    //             }
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await utils.expectThrow(locker.omniverseTransfer(txData), 'Wrong destination');
    //         });
    //     });
    
    //     describe('All conditions satisfied', function() {
    //         it('should succeed', async () => {
    //             let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //             let txData = {
    //                 nonce: 0,
    //                 chainId: 'ETHEREUM',
    //                 from: ownerPk,
    //                 to: 'skywalker',
    //                 data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
    //             }
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await locker.omniverseTransfer(txData);
    //             let count = await locker.getDelayedTxCount();
    //             assert(count == 1, 'The number of delayed txs should be one');
    //         });
    //     });
    
    //     describe('Malicious transaction', function() {
    //         it('should fail', async () => {
    //             let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //             let txData = {
    //                 nonce: 0,
    //                 chainId: 'ETHEREUM',
    //                 from: ownerPk,
    //                 to: 'skywalker',
    //                 data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [1, transferData]),
    //             }
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await locker.omniverseTransfer(txData), 'Wrong destination';
    //             let count = await locker.getDelayedTxCount();
    //             assert(count == 1, 'The number of delayed txs should be one');
    //         });
    //     });
    
    //     describe('User is malicious', function() {
    //         it('should fail', async () => {
    //             let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //             let txData = {
    //                 nonce: 0,
    //                 chainId: 'ETHEREUM',
    //                 from: ownerPk,
    //                 to: 'skywalker',
    //                 data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
    //             }
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await utils.expectThrow(locker.omniverseTransfer(txData), 'User is malicious');
    //         });
    //     });
    // });
    
    // describe('Get executable delayed transaction', function() {
    //     before(async function() {
    //         await initContract();
    //         let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //         let txData = {
    //             nonce: 0,
    //             chainId: 'ETHEREUM',
    //             from: ownerPk,
    //             to: 'skywalker',
    //             data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
    //         }
    //         let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //             Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //         let hash = keccak256(bData);
    //         let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //         txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //         await locker.omniverseTransfer(txData);
    //     });

    //     describe('Cooling down', function() {
    //         it('should be none', async () => {
    //             let tx = await locker.getExecutableDelayedTx();
    //             assert(tx.sender == '0x', 'There should be no transaction');
    //         });
    //     });

    //     describe('Cooled down', function() {
    //         it('should be one transaction', async () => {
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let tx = await locker.getExecutableDelayedTx();
    //             assert(tx.sender == ownerPk, 'There should be one transaction');
    //         });
    //     });
    // });
    
    // describe('Trigger execution', function() {
    //     before(async function() {
    //         await initContract();
    //     });

    //     describe('No delayed transaction', function() {
    //         it('should fail', async () => {
    //             await utils.expectThrow(locker.triggerExecution(), 'No delayed tx');
    //         });
    //     });

    //     describe('Not executable', function() {
    //         it('should fail', async () => {
    //             let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //             let txData = {
    //                 nonce: 0,
    //                 chainId: 'ETHEREUM',
    //                 from: ownerPk,
    //                 to: 'skywalker',
    //                 data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
    //             }
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await locker.omniverseTransfer(txData);
    //             await utils.expectThrow(locker.triggerExecution(), 'Not executable');
    //         });
    //     });
    // });
    
    // describe('Mint', function() {
    //     before(async function() {
    //         await initContract();
    //     });

    //     describe('Not owner', function() {
    //         it('should fail', async () => {
                // let nonce = await protocol.getTransactionCount(from.pk);
    //             let txData = encodeMint({pk: user2Pk, sk: user2Sk}, user1Pk, ONE_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseNotOwner');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //         });
    //     });

    //     describe('Is owner', function() {
    //         it('should succeed', async () => {
                // let nonce = await protocol.getTransactionCount(from.pk);
    //             let txData = encodeMint({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             let o = await locker.owner();
    //             assert(ret.logs[0].event == 'OmniverseTokenTransfer');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert(ONE_TOKEN == balance, 'Balance should be one');
    //         });
    //     });
    // });
    
    // describe('Transfer', function() {
    //     before(async function() {
    //         await initContract();
    //         await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
    //     });

    //     describe('Exceed balance', function() {
    //         it('should fail', async () => {
    //             let nonce = await protocol.getTransactionCount(user1Pk);
    //             let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert(ONE_TOKEN == balance, 'Balance should be one');
    //             balance = await locker.omniverseBalanceOf(user2Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //         });
    //     });

    //     describe('Balance enough', function() {
    //         it('should succeed', async () => {
    //             let nonce = await protocol.getTransactionCount(user1Pk);
    //             let txData = encodeTransfer({pk: user1Pk, sk: user1Sk}, user2Pk, ONE_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseTokenTransfer');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //             balance = await locker.omniverseBalanceOf(user2Pk);
    //             assert(ONE_TOKEN == balance, 'Balance should be one');
    //         });
    //     });
    // });
    
    // describe('Approve', function() {
    //     before(async function() {
    //         await initContract();
    //         await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
    //     });

    //     describe('Exceed balance', function() {
    //         it('should fail', async () => {
    //             let nonce = await protocol.getTransactionCount(user1Pk);
    //             let txData = encodeApprove({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert(ONE_TOKEN == balance, 'Balance should be one');
    //             balance = await locker.omniverseBalanceOf(user2Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //         });
    //     });

    //     describe('Balance enough', function() {
    //         it('should succeed', async () => {
    //             let nonce = await protocol.getTransactionCount(user1Pk);
    //             let txData = encodeApprove({pk: user1Pk, sk: user1Sk}, user2Pk, ONE_TOKEN, nonce);
    //             await locker.omniverseTransfer(txData);
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'Transfer');
    //             assert(ret.logs[1].event == 'Approval');
    //             assert(ret.logs[2].event == 'OmniverseTokenApproval');
    //             let balance = await locker.omniverseBalanceOf(user1Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //             balance = await locker.omniverseBalanceOf(user2Pk);
    //             assert('0' == balance, 'Balance should be zero');
    //             balance = await locker.balanceOf(user1);
    //             assert(ONE_TOKEN == balance, 'Balance should be one');
    //             allowance = await locker.allowance(user1, user2);
    //             assert(ONE_TOKEN == allowance, 'Allowance should be one');
    //         });
    //     });
    // });
    
    describe('Transfer from', function() {
        before(async function() {
            await initContract();
            await mintToken({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
            let nonce = await protocol.getTransactionCount(user1Pk);
            let txData = encodeApprove({pk: user1Pk, sk: user1Sk}, user2Pk, TEN_TOKEN, nonce);
            await locker.omniverseTransfer(txData);
            await utils.sleep(COOL_DOWN);
            await utils.evmMine(1);
            let ret = await locker.triggerExecution();
        });

        describe('Insufficient allowance', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user2Pk);
                let txData = encodeTransferFrom({pk: user2Pk, sk: user2Sk}, user1Pk, ownerPk, HUNDRED_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                console.log('ret.logs', ret.logs);
                assert(ret.logs[0].event == 'OmniverseError');
                assert(ret.logs[0].args[1] == 'Insufficient allowance');
                let balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.balanceOf(user2);
                assert('0' == balance, 'Balance should be zero');
                allowance = await locker.allowance(user1, user2);
                assert('0' == allowance, 'Allowance should be zero');
                balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(ownerPk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });

        describe('Transfer amount exceeds balance', function() {
            it('should fail', async () => {
                let nonce = await protocol.getTransactionCount(user2Pk);
                let txData = encodeTransferFrom({pk: user2Pk, sk: user2Sk}, user1Pk, ownerPk, TEN_TOKEN, nonce);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                console.log('ret.logs', ret.logs);
                assert(ret.logs[0].event == 'OmniverseError');
                assert(ret.logs[0].args[1] == 'Transfer amount exceeds balance');
                let balance = await locker.balanceOf(user1);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.balanceOf(user2);
                assert('0' == balance, 'Balance should be zero');
                allowance = await locker.allowance(user1, user2);
                assert('0' == allowance, 'Allowance should be zero');
                balance = await locker.omniverseBalanceOf(user1Pk);
                assert('0' == balance, 'Balance should be zero');
                balance = await locker.omniverseBalanceOf(ownerPk);
                assert(ONE_TOKEN == balance, 'Balance should be one');
            });
        });

        // describe('Balance enough', function() {
        //     it('should succeed', async () => {
        //         let nonce = await protocol.getTransactionCount(user1Pk);
        //         let txData = encodeApprove({pk: user1Pk, sk: user1Sk}, user2Pk, ONE_TOKEN, nonce);
        //         await locker.omniverseTransfer(txData);
        //         await utils.sleep(COOL_DOWN);
        //         await utils.evmMine(1);
        //         let ret = await locker.triggerExecution();
        //         assert(ret.logs[0].event == 'Transfer');
        //         assert(ret.logs[1].event == 'Approval');
        //         assert(ret.logs[2].event == 'OmniverseTokenApproval');
        //         let balance = await locker.omniverseBalanceOf(user1Pk);
        //         assert('0' == balance, 'Balance should be zero');
        //         balance = await locker.omniverseBalanceOf(user2Pk);
        //         assert('0' == balance, 'Balance should be zero');
        //         balance = await locker.balanceOf(user1);
        //         assert(ONE_TOKEN == balance, 'Balance should be one');
        //         allowance = await locker.allowance(user1, user2);
        //         assert(ONE_TOKEN == allowance, 'Allowance should be one');
        //     });
        // });
    });
});