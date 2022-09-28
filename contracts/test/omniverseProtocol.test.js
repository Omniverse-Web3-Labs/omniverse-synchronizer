const utils = require('./utils');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const Web3 = require('web3');
const web3js = new Web3(Web3.givenProvider);
const assert = require('assert');

const ONE_TOKEN = '1000000000000000000';
const TOKEN_ID = 'skywalker';
const COOL_DOWN = 2;

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

const owner = '0x8ee8f0f6c58da9b4816d03843eaff828d53d4119';
const user1 = '0xdf447702281df2fb9f6f4eb294ebe5626ada168e';
const user2 = '0x0d378e49aeb0462cdc42ee80c30096f4e9ec4c08';

const ownerPk = '0x03415b5f599e6efce1101f35e5bcda1fe626c211a2cd48db193f3550e3847c0e3687ff1ffcb0147d8984f0ae8e178c4f35cde7c67aa9873e27498891d839ef0b';
const user1Pk = '0x77c8fd82e2703c2b60b39b2d953345bafab600c9b1d330c36e3d259e77db01975d2c4dd7978fa2f7d834fc2ba49bec67ae41952d67600a470a9f53ce37de660a';
const user2Pk = '0xd0d16a005ebf5ac38f3d4caa6a6559747ad48351e5976eec66c3178acc60a19318448efd0a009b17b089bfdc32bf63839681957292f9575293d3760ed8181fd2';

const ownerSk = Buffer.from('1e483ad13e569b90ec5aa7b12b647c6b9dbea560e7f9a2397dd35a692d3b9c0d', 'hex');
const user1Sk = Buffer.from('e68a47d1cdd6e959e9ff754c3e6f57e2afeb23b066c61287efe94d26b584eed4', 'hex');
const user2Sk = Buffer.from('ef74a1388ed6914e95ddccb5c7fe6dc9aa2f7f957f02c24429acd6f7582fd40f', 'hex');

let encodeMint = (from, toPk, amount) => {
    let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [toPk, amount]);
    let txData = {
        nonce: 0,
        chainId: 'ETHEREUM',
        from: from.pk,
        to: 'skywalker',
        data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [MINT, transferData]),
    }
    let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    let hash = keccak256(bData);
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(from.sk));
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(user1Sk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex');
//                 await utils.expectThrow(protocol.verifyTransaction(txData), 'Signature verifying failed');
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
//                 let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
//                     Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
//                 let hash = keccak256(bData);
//                 let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
//                 txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
//                 await protocol.verifyTransaction(txData);
//                 let malicious = await protocol.isMalicious(ownerPk);
//                 assert(malicious, "It should be malicious");
//             });
//         });
//     });
// });
    
contract('SkywalkerFungible', function(accounts) {
    console.log('accounts', accounts);

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
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
    //         let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
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
    //             let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //                 Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //             let hash = keccak256(bData);
    //             let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //             txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //             await locker.omniverseTransfer(txData);
    //             await utils.expectThrow(locker.triggerExecution(), 'Not executable');
    //         });
    //     });
    // });
    
    describe('Mint', function() {
        before(async function() {
            await initContract();
        });

        describe('Not owner', function() {
            it('should fail', async () => {
                let txData = encodeMint({pk: user2Pk, sk: user2Sk}, user1Pk, ONE_TOKEN);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                assert(ret.logs[0].event == 'OmniverseNotOwner');
            });
        });

        describe('Is owner', function() {
            it('should succeed', async () => {
                let txData = encodeMint({pk: ownerPk, sk: ownerSk}, user1Pk, ONE_TOKEN);
                await locker.omniverseTransfer(txData);
                await utils.sleep(COOL_DOWN);
                await utils.evmMine(1);
                let ret = await locker.triggerExecution();
                let o = await locker.owner();
                console.log('ret.logs[0]', ret, ret.logs[0], o);
                assert(ret.logs[0].event == 'OmniverseTokenTransfer');
                let balance = await locker.omniverseBalanceOf(ownerPk);
                assert(ONE_TOKEN == balance.toString(), 'Balance should be one');
            });
        });
    });
    
    // describe('Transfer', function() {
    //     before(async function() {
    //         await initContract();
    //         let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
    //         let txData = {
    //             nonce: 0,
    //             chainId: 'ETHEREUM',
    //             from: ownerPk,
    //             to: 'skywalker',
    //             data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [1, transferData]),
    //         }
    //         let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
    //             Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    //         let hash = keccak256(bData);
    //         let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
    //         txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
    //         await locker.omniverseTransfer(txData);
    //     });

    //     describe('Exceed balance', function() {
    //         it('should fail', async () => {
    //             await utils.sleep(COOL_DOWN);
    //             await utils.evmMine(1);
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
    //         });
    //     });

    //     describe('Balance enough', function() {
    //         it('should succeed', async () => {
    //             let ret = await locker.triggerExecution();
    //             assert(ret.logs[0].event == 'OmniverseTokenExceedBalance');
    //         });
    //     });
    // });
});