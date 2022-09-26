const debug = require('debug')('ck');
const BN = require('bn.js');
const utils = require('./utils');
const web3 = require('web3');
const web3js = new web3(web3.givenProvider);

const OmniverseProtocol = artifacts.require('./OmniverseProtocol.sol');
const Locker = artifacts.require('./SkyWalkerFungible.sol');

contract('OmniverseProtocol', function(accounts) {
    let owner = accounts[0];
    let user1 = accounts[1];
    let user2 = accounts[2];
    let user3 = accounts[3];
    let user4 = accounts[4];
    let user5 = accounts[5];
    let user6 = accounts[6];

    let protocol;
    let locker;

    let initContract = async function() {
        protocol = await OmniverseProtocol.new();
        locker = await Locker.new();
        await locker.setOmniverseProtocolAddress(protocol.address);
        // await protocol.setCoo
    }
    
    contract('Verify transaction', function() {
        before(async function() {
            await initContract();
        });

        describe('Signature error', function() {
            it('should fail', async () => {
                let txData = {
                    nonce: 0,
                    chainId: 'ETHEREUM',
                    from: ''
                }
                let messageCount = await crossChain.getSentMessageNumber('NEAR');
                console.log('messageCount', messageCount);
                assert(messageCount.eq(new BN('1')));
                
                let item0 = {
                    name: 'greeting',
                    msgType: 0,
                    value: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000046173646600000000000000000000000000000000000000000000000000000000',
                };
                let item1 = {
                    name: 'u8array',
                    msgType: 12,
                    value: '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000009',
                };
                let calldata = {items: [item0, item1]}
                let argument = {
                    id: 1,
                    fromChain: 'POLKADOT',
                    toChain: 'POLKADOT',
                    sender: '0x0101010101010101010101010101010101010101010101010101010101010101',
                    signer: '0x0101010101010101010101010101010101010101010101010101010101010101',
                    sqos: [[5, '0x12345678']],
                    content: {contractAddress: '0x0000000000000000000000000000000000000000000000000000000000001234', action: '0x12345678', data: calldata},
                    session: [0, 0, "0x11111111", "0x22", "0x33"]
                };
                await LibraryTest.link(verify);
                let lt = await LibraryTest.new();
                let raw = await lt.getRawDataSent(argument);
                console.log('raw', raw);
            });
    
            it('should have stored the previous message', async () => {
                let message = await crossChain.getSentMessage('NEAR', 1);
                eq(message.id, 1);
                eq(message.fromChain, 'test');
                eq(message.toChain, 'NEAR');
                eq(message.sender.toLowerCase(), user1.toLowerCase());
                eq(message.content.contractAddress, '0x');
                eq(message.content.action, '0x');
                eq(message.content.data.items.length, 1);
            });
        });
    });

    contract('Message clearing', function() {
        before(async function() {
            await initContract();
        });

        it('should succeed', async () => {
            let to = locker.address;
            let action = '0x11111111';
            let item = {
                name: 'greeting',
                msgType: 11,
                value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006504c41544f4e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094772656574696e6773000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000144772656574696e672066726f6d20504c41544f4e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000374d6f6e204a756e20323720323032322031363a33343a323820474d542b3038303020284368696e61205374616e646172642054696d6529000000000000000000',
            };
            let calldata = {items: [item]};
            let argument = [1, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, '0x00000000', '0x', '0x'], 0];
            await crossChain.receiveMessage(argument, {from: user1});
            await crossChain.receiveMessage(argument, {from: user2});
            await crossChain.receiveMessage(argument, {from: user3});
            await crossChain.clearCrossChainMessage('NEAR');
            let messageNumber = await crossChain.getReceivedMessageNumber('NEAR');
            assert(messageNumber == 0);
            let message = await crossChain.getReceivedMessage('NEAR', 1);
            console.log('message', message);
        });
    });

    contract('Message receiving', function() {
        before(async function() {
            await initContract();
        });

        describe('Not Router', function() {
            it('should fail', async () => {
                let to = locker.address;
                let action = '0x11111111';
                let item = {
                    name: 'greeting',
                    msgType: 11,
                    value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006504c41544f4e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094772656574696e6773000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000144772656574696e672066726f6d20504c41544f4e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000374d6f6e204a756e20323720323032322031363a33343a323820474d542b3038303020284368696e61205374616e646172642054696d6529000000000000000000',
                };
                let calldata = {items: [item]};
                let argument = [10, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, "0x11111111", "0x", "0x"], 0];
                await utils.expectThrow(crossChain.receiveMessage(argument), 'not router');
            });
        });

        describe('Id not match', function() {
            it('should fail', async () => {
                let to = locker.address;
                let action = '0x11111111';
                let item = {
                    name: 'greeting',
                    msgType: 11,
                    value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006504c41544f4e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094772656574696e6773000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000144772656574696e672066726f6d20504c41544f4e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000374d6f6e204a756e20323720323032322031363a33343a323820474d542b3038303020284368696e61205374616e646172642054696d6529000000000000000000',
                };
                let calldata = {items: [item]};
                let argument = [10, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, "0x11111111", "0x", "0x"], 0];
                await utils.expectThrow(crossChain.receiveMessage(argument, {from: user1}), 'not match');
            });
        });
            
        describe('Id match', function() {
            it('should receive successfully', async () => {
                let to = locker.address;
                let action = '0x11111111';
                let item = {
                    name: 'greeting',
                    msgType: 11,
                    value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006504c41544f4e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094772656574696e6773000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000144772656574696e672066726f6d20504c41544f4e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000374d6f6e204a756e20323720323032322031363a33343a323820474d542b3038303020284368696e61205374616e646172642054696d6529000000000000000000',
                };
                let calldata = {items: [item]};
                let argument = [1, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, '0x00000000', '0x', '0x'], 0];
                await crossChain.receiveMessage(argument, {from: user1});
                await crossChain.receiveMessage(argument, {from: user2});
                await crossChain.receiveMessage(argument, {from: user3});
                let number = await crossChain.getReceivedMessageNumber('NEAR');
                assert(number.eq(new BN('1')));
                number = await crossChain.getNextMessageId('NEAR', user1);
                assert(number.eq(new BN('2')));
                let ID = await crossChain.getExecutableMessageId('NEAR');
                eq(ID, 1);
            });
        });

        // contract('It is at the second two-step-commit stage', function() {
        //     before(async function() {
        //         await initContract();
        //         let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
        //         await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1});
        //         await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user2});
        //         await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user3});
        //     });

        //     it('should failed', async () => {
        //         let to = locker.address;
        //         let action = '0x11111111';
        //         let item = {
        //             name: 'greeting',
        //             msgType: 11,
        //             value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006504c41544f4e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094772656574696e6773000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000144772656574696e672066726f6d20504c41544f4e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000374d6f6e204a756e20323720323032322031363a33343a323820474d542b3038303020284368696e61205374616e646172642054696d6529000000000000000000',
        //         };
        //         let calldata = {items: [item]};
        //         let argument = [1, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, "0x11111111", "0x", "0x"], 0];
        //         await utils.expectThrow(crossChain.receiveMessage(argument, {from: user1}), 'It is the second stage');
        //     });
        // });
    });

    describe('Message executing', function() {
        async function constructMessage() {
            await initContract();
            // receive message
            let to = locker.address;
            let action = '0x533017fb';
            let item = {
                name: 'message',
                msgType: 0,
                // Hello World
                value: '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20576f726c64000000000000000000000000000000000000000000',
            };
            let calldata = {items: [item]};
            let argument = [1, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, "0x", "0x", "0x"], 0];
            await crossChain.receiveMessage(argument, {from: user1});
            await crossChain.receiveMessage(argument, {from: user2});
            await crossChain.receiveMessage(argument, {from: user3});
        }

        contract('Not Permitted', function() {
            before(async function() {
                await constructMessage();
            });
    
            it('should executed failed', async () => {
                let ret = await crossChain.executeMessage('NEAR', 1);
                assert.equal(ret.logs[0].event, 'ExecuteFailed');
                assert.equal(ret.logs[0].args.errorCode, 0);
            });
        });
        
        contract('Caller not cross-chain contract', function() {
            before(async function() {
                await constructMessage();
            });
    
            it('should execute failed', async () => {
                await locker.setCrossChainContract(user1);
                await locker.setPass(true);
                let ret = await crossChain.executeMessage('NEAR', 1);
                assert.equal(ret.logs[0].event, 'ExecuteFailed');
                assert.equal(ret.logs[0].args.errorCode, 100);
            });
        });
        
        contract('Callee Reverts', function() {
            before(async function() {
                await constructMessage();
            });
    
            it('should execute failed', async () => {
                await locker.setPass(true);
                await locker.setPanic(true);
                let ret = await crossChain.executeMessage('NEAR', 1);
                assert.equal(ret.logs[0].event, 'ExecuteFailed');
                assert(ret.logs[0].args.errorCode.eq(new BN('1')));
            });
        });
        
        contract('Callee Returns Error', function() {
            before(async function() {
                await constructMessage();
            });
    
            it('should execute failed', async () => {
                await locker.setPass(true);
                await locker.setResult(101);
                let ret = await crossChain.executeMessage('NEAR', 1);
                assert.equal(ret.logs[0].event, 'ExecuteFailed');
                assert(ret.logs[0].args.errorCode > 100);
            });
        });        
        
        contract('Callee Reverts 0', function() {
            before(async function() {
                await constructMessage();
            });
    
            it('should execute successfully', async () => {
                await locker.setPass(true);
                await locker.setResult(0);
                let ret = await crossChain.executeMessage('NEAR', 1);
                assert.equal(ret.logs[0].event, 'MessageExecuted');
                let message = await locker.receivedMessage();
                eq(message, 'Hello World');
            });

            describe('Message which has been executed', function() {
                it('should execute failed', async () => {
                    await utils.expectThrow(crossChain.executeMessage('NEAR', 1), 'not executable');
                });
            });
        });

        contract('Arbitrary message', function() {
            before(async function() {
                await initContract();
            });

            it('should execute successfully', async () => {
                await locker.setPass(true);
                let to = locker.address;
                let action = '0xb6add073';
                let item = {
                    name: 'greeting',
                    msgType: 12,
                    value: web3js.eth.abi.encodeParameter('bytes', '0x010203'),
                };
                let calldata = {items: [item]};
                let argument = [1, 'NEAR', 'NEAR', '0x', user1, [], to, action, calldata, [0, 0, '0x00000000', '0x', '0x'], 0];
                await crossChain.receiveMessage(argument, {from: user1});
                await crossChain.receiveMessage(argument, {from: user2});
                await crossChain.receiveMessage(argument, {from: user3});
                let ret = await crossChain.executeMessage('NEAR', 1);
                console.log(await locker.arbitrary());
            });
        });
    });

    contract('Message abandoning', function() {
        before(async function() {
            await initContract();
        });

        it('should abandon successfully', async () => {
            await crossChain.abandonMessage('NEAR', 1, 1, {from: user1});
            await crossChain.abandonMessage('NEAR', 1, 1, {from: user2});
            await crossChain.abandonMessage('NEAR', 1, 1, {from: user3});
            let number = await crossChain.getReceivedMessageNumber('NEAR');
            assert(number.eq(new BN('1')));
            number = await crossChain.getNextMessageId('NEAR', user1);
            assert(number.eq(new BN('2')));                
            let ID = await crossChain.getExecutableMessageId('NEAR');
            assert(ID.eq(new BN('0')));
        });
    });

    // describe('Receive hidden message', function() {
    //     contract('ID not match', function() {
    //         before(async function() {
    //             await initContract();
    //         });

    //         it('should failed', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await utils.expectThrow(crossChain.receiveHiddenMessage('NEAR', 2, hash, {from: user1}), 'id not match');
    //         });
    //     });

    //     contract('The message of this id has been aggregated', function() {
    //         before(async function() {
    //             await initContract();
    //         });

    //         before(async function() {
    //             // receive message
    //             let to = locker.address;
    //             let action = 'receiveMessage';
    //             let crossChain = await CrossChain.deployed();
    //             let function_str = await crossChain.interfaces(user1, action);
    //             let function_json = JSON.parse(function_str);
    //             let calldata = web3js.eth.abi.encodeFunctionCall(function_json, ['Hello World']);
    //             await crossChain.receiveMessage('NEAR', 1, 'near_address', user1, to, {reveal: 0}, action, calldata, {resType: 0, id: 0}, {from: user1});
    //             await crossChain.receiveMessage('NEAR', 1, 'near_address', user1, to, {reveal: 0}, action, calldata, {resType: 0, id: 0}, {from: user2});
    //             await crossChain.receiveMessage('NEAR', 1, 'near_address', user1, to, {reveal: 0}, action, calldata, {resType: 0, id: 0}, {from: user3});
    //         });

    //         it('should failed', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await utils.expectThrow(crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1}), 'been aggregated');
    //         });
    //     });

    //     contract('The message is not at the first stage', function() {
    //         before(async function() {
    //             await initContract();
    //             // receive message
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1});
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user2});
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user3});
    //         });

    //         it('should failed', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await utils.expectThrow(crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user4}), 'It is not the first stage');
    //         });
    //     });

    //     contract('Duplicate commit', function() {
    //         before(async function() {
    //             await initContract();
    //         });
            
    //         it('should failed', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1});
    //             await utils.expectThrow(crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1}), 'duplicate commit');
    //         });
    //     });

    //     contract('Normal process', function() {
    //         before(async function() {
    //             await initContract();
    //         });

    //         it('should execute successfully', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1});
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user2});
    //             await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user3});
    //             let message = await crossChain.getFirstStageMessage('NEAR', 1);
    //             eq(message.stage, 2);
    //         });
    //     });
    // });

    // describe('Reveal message', function() {
    //     let sqos = {reveal: 0};
    //     let action = 'receiveMessage';
    //     let calldata;

    //     let firstStage = async function() {
    //         let crossChain = await CrossChain.deployed();
    //         let function_str = await crossChain.interfaces(user1, action);
    //         let function_json = JSON.parse(function_str);
    //         calldata = web3js.eth.abi.encodeFunctionCall(function_json, ['Hello World']);
    //         let to = locker.address;
    //         let getHash = (user) => {
    //             let d = web3js.eth.abi.encodeParameters(['string','string', 'tuple(uint8)', 'address','string','bytes','address'],
    //                 [sender, signer, [sqos.reveal], to, action, calldata, user]);
    //             let hash = web3.utils.sha3(d);
    //             return hash;
    //         }
    //         await crossChain.receiveHiddenMessage('NEAR', 1, getHash(user1), {from: user1});
    //         await crossChain.receiveHiddenMessage('NEAR', 1, getHash(user2), {from: user2});
    //         await crossChain.receiveHiddenMessage('NEAR', 1, getHash(user3), {from: user3});
    //     }

    //     contract('Not the second stage', function() {            
    //         before(async function() {
    //             await initContract();
    //             let crossChain = await CrossChain.deployed();
    //             let function_str = await crossChain.interfaces(user1, action);
    //             let function_json = JSON.parse(function_str);
    //             calldata = web3js.eth.abi.encodeFunctionCall(function_json, ['Hello World']);
    //         });

    //         describe('No hidden message committed', function() {
    //             it('should failed', async () => {
    //                 let crossChain = await CrossChain.deployed();
    //                 await utils.expectThrow(crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user1}), 'It is not the second stage');
    //             });
    //         });

    //         describe('It is at the second stage', function() {
    //             before(async function() {
    //                 let crossChain = await CrossChain.deployed();
    //                 let hash = '0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba';
    //                 await crossChain.receiveHiddenMessage('NEAR', 1, hash, {from: user1});
    //             });

    //             it('should failed', async () => {
    //                 let crossChain = await CrossChain.deployed();
    //                 await utils.expectThrow(crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user1}), 'It is not the second stage');
    //             });
    //         });
    //     });

    //     contract('Router did not finish the first stage', function() {            
    //         before(async function() {
    //             await initContract();
    //             await firstStage();
    //         });

    //         it('should failed', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             await utils.expectThrow(crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user4}), 'Router did not finish the first stage');
    //         });
    //     });

    //     contract('Normal process', function() {
    //         before(async function() {
    //             await initContract();
    //             await firstStage();
    //         });

    //         it('should execute successfully', async () => {
    //             let crossChain = await CrossChain.deployed();
    //             await crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user1});
    //             await crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user2});
    //             await crossChain.revealMessage(fromChain, 1, sender, signer, locker.address, sqos, action, calldata, {resType: 0, id: 0}, {from: user3});
    //             let message = await crossChain.getFirstStageMessage('NEAR', 1);
    //             eq(message.stage, 3);
    //         });
    //     });
    // });
});