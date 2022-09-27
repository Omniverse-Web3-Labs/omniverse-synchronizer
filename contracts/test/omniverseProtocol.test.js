const utils = require('./utils');
const secp256k1 = require('secp256k1');
const keccak256 = require('keccak256');
const web3 = require('web3');
const web3js = new web3(web3.givenProvider);
const assert = require('assert');

const ONE_TOKEN = '1000000000000000000';
const TOKEN_ID = 'skywalker';

const OmniverseProtocol = artifacts.require('./OmniverseProtocol.sol');
const Locker = artifacts.require('./SkyWalkerFungible.sol');

contract('OmniverseProtocol', function(accounts) {
    let owner = accounts[0];
    let user1 = accounts[1];
    let user2 = accounts[2];

    let ownerPk = '0x03415b5f599e6efce1101f35e5bcda1fe626c211a2cd48db193f3550e3847c0e3687ff1ffcb0147d8984f0ae8e178c4f35cde7c67aa9873e27498891d839ef0b';
    let user1Pk = '0x77c8fd82e2703c2b60b39b2d953345bafab600c9b1d330c36e3d259e77db01975d2c4dd7978fa2f7d834fc2ba49bec67ae41952d67600a470a9f53ce37de660a';
    let user2Pk = '0xd0d16a005ebf5ac38f3d4caa6a6559747ad48351e5976eec66c3178acc60a19318448efd0a009b17b089bfdc32bf63839681957292f9575293d3760ed8181fd2';

    let ownerSk = Buffer.from('1e483ad13e569b90ec5aa7b12b647c6b9dbea560e7f9a2397dd35a692d3b9c0d', 'hex');
    let user1Sk = Buffer.from('e68a47d1cdd6e959e9ff754c3e6f57e2afeb23b066c61287efe94d26b584eed4', 'hex');
    let user2Sk = Buffer.from('ef74a1388ed6914e95ddccb5c7fe6dc9aa2f7f957f02c24429acd6f7582fd40f', 'hex');

    let protocol;
    let locker;

    let initContract = async function() {
        protocol = await OmniverseProtocol.new();
        locker = await Locker.new(TOKEN_ID, TOKEN_ID, TOKEN_ID);
        await locker.setOmniverseProtocolAddress(protocol.address);
        await protocol.setCooingDownTime(60);
    }
    
    contract('Verify transaction', function() {
        before(async function() {
            await initContract();
        });

        describe('Signature error', function() {
            it('should fail', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 0,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex');
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Signature verifying failed');
            });
        });

        describe('Nonce error', function() {
            it('should succeed', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 1,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Nonce error');
            });
        });

        describe('All conditions satisfied', function() {
            it('should succeed', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 0,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
                await protocol.verifyTransaction(txData);
            });
        });

        describe('Cooling down', function() {
            it('should fail', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 1,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction cooling down');
            });
        });

        describe('Transaction duplicated', function() {
            it('should fail', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 0,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
                await utils.expectThrow(protocol.verifyTransaction(txData), 'Transaction duplicated');
            });
        });

        describe('Malicious', function() {
            it('should fail', async () => {
                let transferData = web3js.eth.abi.encodeParameters(['bytes', 'uint256'], [user2Pk, ONE_TOKEN]);
                let txData = {
                    nonce: 0,
                    chainId: 'ETHEREUM',
                    from: ownerPk,
                    to: 'skywalker1',
                    data: web3js.eth.abi.encodeParameters(['uint8', 'bytes'], [0, transferData]),
                }
                let bData = Buffer.concat([Buffer.from(txData.nonce.toString().padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
                    Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
                let hash = keccak256(bData);
                let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(ownerSk));
                txData.signature = '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
                await protocol.verifyTransaction(txData);
                let malicious = await protocol.isMalicious(ownerPk);
                assert(malicious, "It should be malicious");
            });
        });
    });
});