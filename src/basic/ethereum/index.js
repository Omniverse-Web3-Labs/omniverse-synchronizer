'use strict';

const Web3 = require('web3');
const config = require('config');
const ethereum = require('./ethereum.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const globalDefine = require('../../utils/globalDefine.js');

const OMNIVERSE_TOKEN_TRANSFER = 'OmniverseTokenTransfer';
const OMNIVERSE_TOKEN_WITHDRAW = 'OmniverseTokenWithdraw';
const OMNIVERSE_TOKEN_DEPOSIT = 'OmniverseTokenDeposit';
const OMNIVERSE_TOKEN_WRONG_OP = 'OmniverseTokenWrongOp';

class EthereumHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "ethereum"));
    // Enable auto reconnection
    const options = {
      reconnect: {
        auto: true,
        delay: 1000, // ms
        maxAttempts: 5,
        onTimeout: false
      }
    };
    let provider = new Web3.providers.WebsocketProvider(config.get('networks.' + this.chainName + '.nodeAddress'), options);
    this.web3 = new Web3(provider);
    this.web3.eth.handleRevert = true;
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];
    // SkywalkerFungible
    let skywalkerFungibleContractAddress = config.get('networks.' + this.chainName + '.skywalkerFungibleContractAddress');
    let skywalkerFungibleRawData = fs.readFileSync(config.get('networks.' + this.chainName + '.skywalkerFungibleAbiPath'));
    let skywalkerFungibleAbi = JSON.parse(skywalkerFungibleRawData).abi;
    this.skywalkerFungibleContract = new this.web3.eth.Contract(skywalkerFungibleAbi, skywalkerFungibleContractAddress);
    this.chainId = config.get('networks.' + this.chainName + '.chainId');
    this.messages = [];
    this.tokenId = config.get('tokenId');

    for (let i = 0; i < skywalkerFungibleAbi.length; i++) {
      if (skywalkerFungibleAbi[i].type == 'event' && skywalkerFungibleAbi[i].name == OMNIVERSE_TOKEN_TRANSFER) {
        this.eventOmniverseTokenTransfer = skywalkerFungibleAbi[i];
        this.eventOmniverseTokenTransfer.signature = this.web3.eth.abi.encodeEventSignature(this.eventOmniverseTokenTransfer);
      }
      else if (skywalkerFungibleAbi[i].type == 'event' && skywalkerFungibleAbi[i].name == OMNIVERSE_TOKEN_WITHDRAW) {
        this.eventOmniverseTokenApproval = skywalkerFungibleAbi[i];
        this.eventOmniverseTokenApproval.signature = this.web3.eth.abi.encodeEventSignature(this.eventOmniverseTokenApproval);
      }
      else if (skywalkerFungibleAbi[i].type == 'event' && skywalkerFungibleAbi[i].name == OMNIVERSE_TOKEN_DEPOSIT) {
        this.eventOmniverseTokenDeposit = skywalkerFungibleAbi[i];
        this.eventOmniverseTokenDeposit.signature = this.web3.eth.abi.encodeEventSignature(this.eventOmniverseTokenDeposit);
      }
      else if (skywalkerFungibleAbi[i].type == 'event' && skywalkerFungibleAbi[i].name == OMNIVERSE_TOKEN_WRONG_OP) {
        this.eventOmniverseTokenWrongOp = skywalkerFungibleAbi[i];
        this.eventOmniverseTokenWrongOp.signature = this.web3.eth.abi.encodeEventSignature(this.eventOmniverseTokenWrongOp);
      }
    }
  }

  async addMessageToList(message) {
    this.messages.push(
      JSON.parse(JSON.stringify(message));
    );
  }

  async pushMessages() {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      let nonce = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionCount', [message.from]);
      if (nonce == message.nonce) {
        let coolingDown = false;
        if (nonce > 0) {
          let txData = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionData', [message.from, nonce - 1]);
          let curTime = parseInt(Date.now() / 1000);
          if (curTime < parseInt(txData.timestamp) + 20) {
            coolingDown = true;
          }
        }

        if (!coolingDown) {
          await ethereum.sendTransaction(this.web3, this.chainId, this.skywalkerFungibleContract, 'omniverseTransfer',
            this.testAccountPrivateKey, [this.messages[i]]);
          this.messages.splice(i, 1);
          break;
        }
        else {
          console.log('Cooling down');
        }
      }
      else {
        console.log('Caching');
      }
    }
  }

  async tryTrigger() {
    let ret = await ethereum.contractCall(this.skywalkerFungibleContract, 'getExecutableDelayedTx', []);
    if (ret.sender != '0x') {
      logger.debug('Delayed transaction', ret);
      let receipt = await ethereum.sendTransaction(this.web3, this.chainId, this.skywalkerFungibleContract, 'triggerExecution',
        this.testAccountPrivateKey, []);
      logger.debug(receipt.logs[0].topics, receipt.logs[0].data);
      for (let i = 0; i < receipt.logs.length; i++) {
        let log = receipt.logs[i];
        if (log.address == this.skywalkerFungibleContract._address) {
          if (log.topics[0] == this.eventOmniverseError.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseError.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute failed: sent by {0}, the reason is {1}.',
              decodedLog.sender, decodedLog.reason));
          }
          else if (log.topics[0] == this.eventOmniverseNotOwner.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseNotOwner.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute failed due to not owner: sent by {0}.', decodedLog.sender));
          }
          else if (log.topics[0] == this.eventOmniverseNotOwner.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseNotOwner.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute failed due to wrong Op: sent by {0}, the op code is {1}.',
              decodedLog.sender, decodedLog.op));
          }
          else if (log.topics[0] == this.eventOmniverseTokenExceedBalance.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenExceedBalance.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute failed due to exceeding balance: {0} is needed from {1}, which only has {2}.',
              decodedLog.value, decodedLog.owner, decodedLog.balance));
          }
          else if (log.topics[0] == this.eventOmniverseTokenDeposit.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenDeposit.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute OmniverseTransferFrom successfully: transfer {0} from {1} to {2}.',
              decodedLog.value, decodedLog.from, decodedLog.to));
          }
          else if (log.topics[0] == this.eventOmniverseTokenApproval.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenApproval.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute OmniverseApprove successfully: {0} approve {1} for {2}.',
              decodedLog.owner, decodedLog.spender, decodedLog.value));
          }
          else if (log.topics[0] == this.eventOmniverseTokenTransfer.signature) {
            let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenTransfer.inputs, log.data, log.topics.slice(1));
            logger.info(utils.format('Execute OmniverseTransfer successfully: {0} transfer {1} to {2}.',
              decodedLog.from, decodedLog.value, decodedLog.to));
          }
        }
      }
    }
  }

  generalizeData(data) {
    let ret = {};
    let opData = this.web3.eth.abi.decodeParameters(['uint8', 'bytes'], data);
    ret.op = opData[0];
    if (ret.op == globalDefine.TokenOpType.TRANSFER) {
      let transferData = this.web3.eth.abi.decodeParameters(['bytes', 'uint256'], opData[1]);
      ret.to = utils.toByteArray(transferData[0]);
      ret.amount = transferData[1];
    }
    else if (ret.op == globalDefine.TokenOpType.MINT) {
      let mintData = this.web3.eth.abi.decodeParameters(['bytes', 'uint256'], opData[1]);
      ret.to = utils.toByteArray(mintData[0]);
      ret.amount = mintData[1];
    }

    return ret;
  }

  async start(callback) {
    this.skywalkerFungibleContract.events.TransactionSent()
    .on("connected", (subscriptionId) => {
      logger.info('connected', subscriptionId);
    })
    .on('data', async (event) => {
      logger.debug('event', event);
      // to be continued, decoding is needed here for omniverse
      console.log(event.returnValues.pk, event.returnValues.nonce);
      let message = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionData', [event.returnValues.pk, event.returnValues.nonce]);
      if (message.txData.to != this.tokenId) {
        console.log('Another destination');
        return;
      }
      let members = await ethereum.contractCall(this.skywalkerFungibleContract, 'getMembers', []);
      let data = this.generalizeData(message.txData.data);
      let m = {
        nonce: message.txData.nonce,
        chainId: message.txData.chainId,
        from: message.txData.from,
        to: message.txData.to,
        data: data,
        signature: message.txData.signature,
      }
      callback(m, members);
    })
    .on('changed', (event) => {
      // remove event from local database
      logger.info('changed');
      logger.debug(event);
    })
    .on('error', (error, receipt) => {
      // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      logger.info('error', this.chainName, error);
      logger.info('receipt', receipt);
    });
  }

  getProvider() {
    return this.web3;
  }
}

module.exports = EthereumHandler;