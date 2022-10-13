const Web3 = require('web3');
const fs = require('fs');
const ethereum = require('./ethereum');
const { program } = require('commander');
const config = require('config');

const TOKEN_ID = 'skywalker';

const TRANSFER_FROM = 0;
const TRANSFER = 1;
const APPROVE = 2;
const MINT = 3;

let web3;
let netConfig;
let chainId;
let omniverseProtocolContract;
let skywalkerFungibleContract;

// Private key
let testAccountPrivateKey = fs.readFileSync('./.secret').toString();
let privateKeyBuffer = Buffer.from(toByteArray(testAccountPrivateKey));
let publicKeyBuffer = eccrypto.getPublic(privateKeyBuffer);

function init(chainName) {
    chainId = chainName;
    netConfig = config.get(chainName);
    if (!netConfig) {
        console.log('Config of chain (' + chainName + ') not exists');
        return false;
    }

    let omniverseProtocolAddress = netConfig.omniverseProtocolAddress;
    // Load contract abi, and init contract object
    const crossChainRawData = fs.readFileSync('./build/contracts/OmniverseProtocol.json');
    const crossChainAbi = JSON.parse(crossChainRawData).abi;
    
    let skywalkerFungibleAddress = netConfig.skywalkerFungibleAddress;
    // Load contract abi, and init contract object
    const routersCoreRawData = fs.readFileSync('./build/contracts/SkywalkerFungible.json');
    const routersCoreAbi = JSON.parse(routersCoreRawData).abi;

    web3 = new Web3(netConfig.nodeAddress);
    web3.eth.handleRevert = true;
    omniverseProtocolContract = new web3.eth.Contract(crossChainAbi, omniverseProtocolAddress);
    skywalkerFungibleContract = new web3.eth.Contract(routersCoreAbi, skywalkerFungibleAddress);

    return true;
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

async function initialize() {
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'setOmniverseProtocolAddress',
        testAccountPrivateKey, [netConfig.omniverseProtocolAddress]);
}

async function transfer(to, amount) {
    let nonce = await omniverseProtocolContract.getTransactionCount(publicKeyBuffer.toString('hex'));
    let transferData = Web3.eth.abi.encodeParameters(['bytes', 'uint256'], [to, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKeyBuffer.toString('hex'),
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    };
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function approve(to, amount) {
    let nonce = await omniverseProtocolContract.getTransactionCount(publicKeyBuffer.toString('hex'));
    let transferData = Web3.eth.abi.encodeParameters(['bytes', 'uint256'], [to, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKeyBuffer.toString('hex'),
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    };
    let bData = getRawData(txData);
    let hash = keccak256(bData);
    txData.signature = signData(hash, from.sk);
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function transfer(to, amount) {
    let nonce = await omniverseProtocolContract.getTransactionCount(publicKeyBuffer.toString('hex'));
    let transferData = Web3.eth.abi.encodeParameters(['bytes', 'uint256'], [to, amount]);
    let txData = {
        nonce: nonce,
        chainId: chainId,
        from: publicKeyBuffer.toString('hex'),
        to: TOKEN_ID,
        data: web3.eth.abi.encodeParameters(['uint8', 'bytes'], [TRANSFER, transferData]),
    };
    await ethereum.sendTransaction(web3, netConfig.chainId, skywalkerFungibleContract, 'omniverseTransfer', testAccountPrivateKey, [txData]);
}

async function test(address) {
    // await ethereum.sendTransaction(web3, netConfig.chainId, omniverseProtocolContract, 'transferOwnership', testAccountPrivateKey, [address]);
    
    // let aa = await ethereum.contractCall(omniverseProtocolContract, 'getNextMessageId', ['FLOWTEST', '0x30ad2981E83615001fe698b6fBa1bbCb52C19Dfa']);
    // let aa = await ethereum.contractCall(omniverseProtocolContract, 'getReceivedMessageNumber', ['SHIBUYA']);
    // let aa = await ethereum.contractCall(omniverseProtocolContract, 'getSentMessageNumber', ['FLOWTEST']);
    // let aa = await ethereum.contractCall(omniverseProtocolContract, 'getReceivedMessage', ['NEARTEST', '2']);
    // let aa = await ethereum.contractCall(omniverseProtocolContract, 'getSentMessage', ['FLOWTEST', '1']);
    let aa = await ethereum.contractCall(skywalkerFungibleContract, 'getSelectedRouters', []);
    
    console.log('aa', aa);
    // let ret = await ethereum.sendTransaction(web3, netConfig.chainId, omniverseProtocolContract, 'executeMessage', testAccountPrivateKey, ['FLOWTEST2', 1]);
    // console.log('ret', ret);
}

(async function () {
    function list(val) {
		return val.split(',')
	}

    program
        .version('0.1.0')
        .option('-i, --initialize <chain name>', 'Initialize omnioverse contracts')
        .option('-c, --clear <chain name>,<dest chain name>', 'Clear data of cross chain contract', list)
        .option('-t, --transfer <chain name>,<address>', 'Transfer ownership', list)
        .parse(process.argv);

    if (program.opts().initialize) {
        if (!init(program.opts().initialize)) {
            return;
        }
        await initialize();
    }
    else if (program.opts().clear) {
        if (program.opts().clear.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().clear.length + ' provided');
            return;
        }
        
        if (!init(program.opts().clear[0])) {
            return;
        }
        await clear(program.opts().clear[1]);
    }
    else if (program.opts().transfer) {
        if (program.opts().transfer.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().transfer.length + ' provided');
            return;
        }
        
        if (!init(program.opts().transfer[0])) {
            return;
        }
        await transfer(program.opts().transfer[1]);
    }
}());
