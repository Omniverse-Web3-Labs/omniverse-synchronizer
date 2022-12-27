const Web3 = require('web3');
const fs = require('fs');
const ethereum = require('./ethereum');
const { program } = require('commander');
const config = require('config');

let web3;
let netConfig;
let chainId;
let omniverseProtocolContract;
let skywalkerFungibleContract;

function init(chainName) {
    netConfig = config.get(chainName);
    chainId = netConfig.omniverseChainId;
    if (!netConfig) {
        console.log('Config of chain (' + chainName + ') not exists');
        return false;
    }

    let omniverseProtocolAddress = netConfig.omniverseProtocolAddress;
    // Load contract abi, and init contract object
    const omniverseProtocolRawData = fs.readFileSync('./build/contracts/OmniverseProtocol.json');
    const omniverProtocolAbi = JSON.parse(omniverseProtocolRawData).abi;

    web3 = new Web3(netConfig.nodeAddress);
    web3.eth.handleRevert = true;
    omniverseProtocolContract = new web3.eth.Contract(omniverProtocolAbi, omniverseProtocolAddress);

    return true;
}

async function omniverseBalanceOf(tokenType, pk) {
    // Load contract abi, and init contract object
    const skywalkerFungibleRawData = fs.readFileSync('./build/contracts/SkywalkerFungible.json');
    const skywalkerFungibleAbi = JSON.parse(skywalkerFungibleRawData).abi;
    let skywalkerFungibleAddress;
    if (tokenType == 'X') {
        skywalkerFungibleAddress = netConfig.skywalkerFungibleAddressX;
    }
    else if (tokenType == 'Y') {
        skywalkerFungibleAddress = netConfig.skywalkerFungibleAddressY;
    }
    else {
        return;
    }
    skywalkerFungibleContract = new web3.eth.Contract(skywalkerFungibleAbi, skywalkerFungibleAddress);
    let amount = await ethereum.contractCall(skywalkerFungibleContract, 'omniverseBalanceOf', [pk]);
    console.log('amount', amount);
}

(async function () {
    function list(val) {
		return val.split(',')
	}

    program
        .version('0.1.0')
        .option('-o, --omniBalance <token type>,<pk>', 'Query the balance of the omniverse token', list)
        .parse(process.argv);

    if (program.opts().omniBalance) {
        if (program.opts().omniBalance.length != 2) {
            console.log('2 arguments are needed, but ' + program.opts().omniBalance.length + ' provided');
            return;
        }
        
        if (!init('BSCTEST')) {
            return;
        }
        await omniverseBalanceOf(program.opts().omniBalance[0], program.opts().omniBalance[1]);
    }
}());
