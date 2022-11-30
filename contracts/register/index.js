const Web3 = require('web3');
const BN = require('bn.js');
const fs = require('fs');
const ethereum = require('./ethereum');
const { program } = require('commander');
const config = require('config');
const utils = require('./utils');
const eccrypto = require('eccrypto');
const keccak256 = require('keccak256');
const secp256k1 = require('secp256k1');

const TOKEN_ID = 'Skywalker';

const DEPOSIT = 0;
const TRANSFER = 1;
const WITHDRAW = 2;
const MINT = 3;

let web3;
let netConfig;
let chainId;
let omniverseProtocolContract;
let skywalkerFungibleContract;

// Private key
let secret = JSON.parse(fs.readFileSync('./register/.secret').toString());
let testAccountPrivateKey = secret.sks[secret.index];
let privateKeyBuffer = Buffer.from(utils.toByteArray(testAccountPrivateKey));
let publicKeyBuffer = eccrypto.getPublic(privateKeyBuffer);
let publicKey = '0x' + publicKeyBuffer.toString('hex').slice(2);
// the first account pk: 0x878fc1c8fe074eec6999cd5677bf09a58076529c2e69272e1b751c2e6d9f9d13ed0165bc1edfe149e6640ea5dd1dc27f210de6cbe61426c988472e7c74f4cc29
// the first account address: 0xD6d27b2E732852D8f8409b1991d6Bf0cB94dd201
// the second account pk: 0x1c0ae2fe60e7b9e91b3690626318c8759147c6daf96147d886d37b4df8dd8829db901b1a4bbb9374b35322660503495597332b3944e49985fa2e827797634799
// the second account address: 0x30ad2981E83615001fe698b6fBa1bbCb52C19Dfa
// the second account pk: 0xcc643d259ada7570872ef9a4fd30b196f5b3a3bae0a6ffabd57fb6a3367fb6d3c5f45cb61994dbccd619bb6f11c522f71a5f636781a1f234fd79ec93bea579d3
// the second account address: 0x8408925fD39071270Ed1AcA5d618e1c79be08B27

function _init(chainName) {
    let chainId = chainName;
    let netConfig = config.get(chainName);
    if (!netConfig) {
        console.log('Config of chain (' + chainName + ') not exists');
        return [false];
    }

    let omniverseProtocolAddress = netConfig.omniverseProtocolAddress;
    // Load contract abi, and init contract object
    const omniverseProtocolRawData = fs.readFileSync('./build/contracts/OmniverseProtocol.json');
    const omniverProtocolAbi = JSON.parse(omniverseProtocolRawData).abi;
    
    let skywalkerFungibleAddress = netConfig.skywalkerFungibleAddress;
    // Load contract abi, and init contract object
    const skywalkerFungibleRawData = fs.readFileSync('./build/contracts/SkywalkerFungible.json');
    const skywalkerFungibleAbi = JSON.parse(skywalkerFungibleRawData).abi;

    let web3 = new Web3(netConfig.nodeAddress);
    web3.eth.handleRevert = true;
    let omniverseProtocolContract = new web3.eth.Contract(omniverProtocolAbi, omniverseProtocolAddress);
    let skywalkerFungibleContract = new web3.eth.Contract(skywalkerFungibleAbi, skywalkerFungibleAddress);

    return [true, web3, omniverseProtocolContract, skywalkerFungibleContract, chainId, netConfig];
}

function init(chainName) {
    let ret = _init(chainName);

    if (ret[0]) {
        web3 = ret[1];
        omniverseProtocolContract = ret[2];
        skywalkerFungibleContract = ret[3];
        chainId = ret[4];
        netConfig = ret[5];
    }

    return ret[0];
}

let signData = (hash, sk) => {
    let signature = secp256k1.ecdsaSign(Uint8Array.from(hash), Uint8Array.from(sk));
    return '0x' + Buffer.from(signature.signature).toString('hex') + (signature.recid == 0 ? '1b' : '1c');
}

let getRawData = (txData) => {
    let bData = Buffer.concat([Buffer.from(new BN(txData.nonce).toString('hex').padStart(32, '0'), 'hex'), Buffer.from(txData.chainId),
        Buffer.from(txData.from.slice(2), 'hex'), Buffer.from(txData.to), Buffer.from(txData.data.slice(2), 'hex')]);
    return bData;
}

async function initialize(committee, members) {
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'setOmniverseProtocolAddress',
        testAccountPrivateKey, [netConfig.omniverseProtocolAddress]);
    await ethereum.sendTransaction(web3, netConfig.chainId, omniverseProtocolContract, 'setCooingDownTime',
        testAccountPrivateKey, [netConfig.coolingDown]);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'addMembers', testAccountPrivateKey, [members]);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'setCommitteeAddress', testAccountPrivateKey, [committee]);
}

async function mint(to, amount) {
    let nonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [publicKey]);
    let transferData = web3.eth.abi.encodeParameters(['bytes', 'uint256'], [to, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKey,
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [MINT, transferData]),
    };
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, privateKeyBuffer);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function transfer(to, amount) {
    let nonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [publicKey]);
    let transferData = web3.eth.abi.encodeParameters(['bytes', 'uint256'], [to, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKey,
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    };
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, privateKeyBuffer);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function withdraw(amount) {
    let nonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [publicKey]);
    let transferData = web3.eth.abi.encodeParameters(['uint256'], [amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKey,
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [WITHDRAW, transferData]),
    };
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, privateKeyBuffer);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function getDepositRequest(index) {
    let ret = await ethereum.contractCall(skywalkerFungibleContract, 'getDepositRequest', [index]);
    console.log(ret);
}

async function sync(toChain, pk) {
    let toChainInfo = _init(toChain);
    if (!toChainInfo[0]) {
        console.log('error init', toChain);
        return;
    }

    let fromNonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [pk]);
    let toNonce = await ethereum.contractCall(toChainInfo[2], 'getTransactionCount', [pk]);
    console.log('nonce', toNonce, fromNonce);
    for (let n = parseInt(toNonce); n < parseInt(fromNonce); n++) {
        let message = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionData', [pk, n]);
        let ret = await ethereum.sendTransaction(toChainInfo[1], toChainInfo[5].chainId, toChainInfo[3], 'omniverseTransfer',
        testAccountPrivateKey, [message.txData]);
        if (!ret) {
            console.log('Send message failed');
        }
    }
}

async function deposit(from, amount) {
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'requestDeposit', testAccountPrivateKey, [from, amount]);
}

async function getNonce(pk) {
    let nonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [pk]);
    console.log(nonce);
}

async function approveDeposit(index) {
    let ret = await ethereum.contractCall(skywalkerFungibleContract, 'getDepositRequest', [index]);
    if (ret.receiver == '0x') {
        console.log('Request not valid');
        return;
    }

    let nonce = await ethereum.contractCall(omniverseProtocolContract, 'getTransactionCount', [publicKey]);
    let transferData = web3.eth.abi.encodeParameters(['bytes', 'uint256'], [ret.receiver, ret.amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKey,
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [DEPOSIT, transferData]),
    };
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, privateKeyBuffer);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'approveDeposit', testAccountPrivateKey, [index, nonce, txData.signature]);
}

async function omniverseBalanceOf(pk) {
    let amount = await ethereum.contractCall(skywalkerFungibleContract, 'omniverseBalanceOf', [pk]);
    console.log('amount', amount);
}

async function balanceOf(address) {
    let amount = await ethereum.contractCall(skywalkerFungibleContract, 'balanceOf', [address]);
    console.log('amount', amount);
}

async function trigger() {
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'triggerExecution',
        testAccountPrivateKey, []);
}

async function getDelayedTx() {
    let ret = await ethereum.contractCall(skywalkerFungibleContract, 'getExecutableDelayedTx', []);
    console.log('ret', ret);
}

async function getAllowance(owner, spender) {
    let ret = await ethereum.contractCall(skywalkerFungibleContract, 'allowance', [owner, spender]);
    console.log('ret', ret);
}

(async function () {
    function list(val) {
		return val.split(',')
	}

    program
        .version('0.1.0')
        .option('-i, --initialize <chain name>,<committee address>,<member name>,...', 'Initialize omnioverse contracts', list)
        .option('-t, --transfer <chain name>,<pk>,<amount>', 'Transfer token', list)
        .option('-a, --withdraw <chain name>,<amount>', 'Withdraw token', list)
        .option('-ad, --approve_deposit <chain name>,<index>', 'Approve deposit', list)
        .option('-m, --mint <chain name>,<pk>,<amount>', 'Mint token', list)
        .option('-dr, --deposit_request <chain name>,<index>', 'Get deposit request', list)
        .option('-f, --deposit <chain name>,<fromPk>,<amount>', 'Transfer token from an account', list)
        .option('-p, --approval <chain name>,<address>,<address>', 'Approved token number', list)
        .option('-o, --omniBalance <chain name>,<pk>', 'Query the balance of the omniverse token', list)
        .option('-b, --balance <chain name>,<address>', 'Query the balance of the local token', list)
        .option('-tr, --trigger <chain name>', 'Trigger the execution of delayed transactions', list)
        .option('-d, --delayed <chain name>', 'Query an executable delayed transation', list)
        .option('-s, --switch <index>', 'Switch the index of private key to be used')
        .option('-sc, --sync <chain name>,<to chain>,<pk>', 'Sync messages from one to the other chain', list)
        .option('-n, --nonce <chain name>,<pk>', 'Nonce of a pk on a chain', list)
        .parse(process.argv);

    if (program.opts().initialize) {
        if (program.opts().initialize.length <= 2) {
            console.log('More than 2 arguments are needed');
            return;
        }
        
        if (!init(program.opts().initialize[0])) {
            return;
        }

        await initialize(program.opts().initialize[1], program.opts().initialize.slice(2));
    }
    else if (program.opts().withdraw) {
        if (program.opts().withdraw.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().withdraw.length + ' provided');
            return;
        }
        
        if (!init(program.opts().withdraw[0])) {
            return;
        }
        await withdraw(program.opts().withdraw[1]);
    }
    else if (program.opts().transfer) {
        if (program.opts().transfer.length != 3) {
            console.log('3 arguments are needed, but ' + program.opts().transfer.length + ' provided');
            return;
        }
        
        if (!init(program.opts().transfer[0])) {
            return;
        }
        await transfer(program.opts().transfer[1], program.opts().transfer[2]);
    }
    else if (program.opts().approve_deposit) {
        if (program.opts().approve_deposit.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().approve_deposit.length + ' provided');
            return;
        }
        
        if (!init(program.opts().approve_deposit[0])) {
            return;
        }
        await approveDeposit(program.opts().approve_deposit[1]);
    }
    else if (program.opts().deposit) {
        if (program.opts().deposit.length != 3) {
            console.log('3 arguments are needed, but ' + program.opts().deposit.length + ' provided');
            return;
        }
        
        if (!init(program.opts().deposit[0])) {
            return;
        }
        await deposit(program.opts().deposit[1], program.opts().deposit[2]);
    }
    else if (program.opts().deposit_request) {
        if (program.opts().deposit_request.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().deposit_request.length + ' provided');
            return;
        }
        
        if (!init(program.opts().deposit_request[0])) {
            return;
        }
        await getDepositRequest(program.opts().deposit_request[1]);
    }
    else if (program.opts().mint) {
        if (program.opts().mint.length != 3) {
            console.log('3 arguments are needed, but ' + program.opts().mint.length + ' provided');
            return;
        }
        
        if (!init(program.opts().mint[0])) {
            return;
        }
        await mint(program.opts().mint[1], program.opts().mint[2]);
    }
    else if (program.opts().omniBalance) {
        if (program.opts().omniBalance.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().omniBalance.length + ' provided');
            return;
        }
        
        if (!init(program.opts().omniBalance[0])) {
            return;
        }
        await omniverseBalanceOf(program.opts().omniBalance[1]);
    }
    else if (program.opts().balance) {
        if (program.opts().balance.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().balance.length + ' provided');
            return;
        }
        
        if (!init(program.opts().balance[0])) {
            return;
        }
        await balanceOf(program.opts().balance[1]);
    }
    else if (program.opts().trigger) {
        if (program.opts().trigger.length != 1) {
            console.log('1 arguments are needed, but ' + program.opts().trigger.length + ' provided');
            return;
        }
        
        if (!init(program.opts().trigger[0])) {
            return;
        }
        await trigger();
    }
    else if (program.opts().delayed) {
        if (program.opts().delayed.length != 1) {
            console.log('1 arguments are needed, but ' + program.opts().delayed.length + ' provided');
            return;
        }
        
        if (!init(program.opts().delayed[0])) {
            return;
        }
        await getDelayedTx();
    }
    else if (program.opts().sync) {
        if (program.opts().sync.length != 3) {
            console.log('3 arguments are needed, but ' + program.opts().sync.length + ' provided');
            return;
        }
        
        if (!init(program.opts().sync[0])) {
            return;
        }
        await sync(program.opts().sync[1], program.opts().sync[2]);
    }
    else if (program.opts().nonce) {
        if (program.opts().nonce.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().nonce.length + ' provided');
            return;
        }
        
        if (!init(program.opts().nonce[0])) {
            return;
        }
        await getNonce(program.opts().nonce[1]);
    }
    else if (program.opts().approval) {
        if (program.opts().approval.length != 3) {
            console.log('3 arguments are needed, but ' + program.opts().approval.length + ' provided');
            return;
        }
        
        if (!init(program.opts().approval[0])) {
            return;
        }
        await getAllowance(program.opts().approval[1], program.opts().approval[2]);
    }
    else if (program.opts().switch) {
        secret.index = parseInt(program.opts().switch);
        fs.writeFileSync('./register/.secret', JSON.stringify(secret, null, '\t'));
    }
}());
