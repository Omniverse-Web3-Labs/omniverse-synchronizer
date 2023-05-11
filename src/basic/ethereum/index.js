'use strict';

const Web3 = require('web3');
const config = require('config');
const ethereum = require('./ethereum.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const globalDefine = require('../../utils/globalDefine');

const OMNIVERSE_TOKEN_TRANSFER = 'OmniverseTokenTransfer';

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
        delay: 5000, // ms
        maxAttempts: 10,
        onTimeout: false
      }
    };
    this.messageBlockHeights = [];
    let provider = new Web3.providers.WebsocketProvider(config.get('networks.' + this.chainName + '.nodeAddress'), options);
    this.web3 = new Web3(provider);
    this.web3.eth.handleRevert = true;
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];
    // omniverseContract
    let omniverseContractAddress = config.get('networks.' + this.chainName + '.omniverseContractAddress');
    let omniverseContractRawData = fs.readFileSync(config.get('networks.' + this.chainName + '.omniverseContractAbiPath'));
    let omniverseContractAbi = JSON.parse(omniverseContractRawData).abi;
    this.omniverseContractContract = new this.web3.eth.Contract(omniverseContractAbi, omniverseContractAddress);
    this.chainId = config.get('networks.' + this.chainName + '.chainId');
    this.omniverseChainId = config.get('networks.' + this.chainName + '.omniverseChainId');
    this.payloadCfg = config.get('payload');
    this.messages = [];

    for (let i = 0; i < omniverseContractAbi.length; i++) {
      if (omniverseContractAbi[i].type == 'event' && omniverseContractAbi[i].name == OMNIVERSE_TOKEN_TRANSFER) {
        this.eventOmniverseTokenTransfer = omniverseContractAbi[i];
        this.eventOmniverseTokenTransfer.signature = this.web3.eth.abi.encodeEventSignature(this.eventOmniverseTokenTransfer);
      }
    }
  }

  async addMessageToList(message) {
    let params = [];
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      if (this.payloadCfg.keys[i] == 'bytes') {
        params.push(utils.toHexString(message.payload[this.payloadCfg.keys[i]]));
      }
      else {
        params.push(message.payload[this.payloadCfg.keys[i]]);
      }
    }
    let opData = this.web3.eth.abi.encodeParameters(this.payloadCfg.types, params);

    this.messages.push({
        nonce: message.nonce,
        initiateSC: message.initiateSC,
        from: message.from,
        chainId: message.chainId,
        payload: opData,
        signature: message.signature,
      });
  }

  async pushMessages() {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      let nonce = await ethereum.contractCall(this.omniverseContractContract, 'getTransactionCount', [message.from]);
      if (nonce >= message.nonce) {
        let txData = await ethereum.contractCall(this.omniverseContractContract, 'transactionCache', [message.from]);
        if (txData.timestamp == 0) {
          let ret = await ethereum.sendTransaction(this.web3, this.chainId, this.omniverseContractContract, 'sendOmniverseTransaction',
            this.testAccountPrivateKey, [this.messages[i]]);
          if (ret) {
            this.messages.splice(i, 1);
            break;
          }
        }
        else {
          logger.info('Cooling down');
        }
      }
      else {
        console.log('Caching');
      }
    }
  }

  async update() {
    let blockNumber = await this.web3.eth.getBlockNumber();
    if (this.messageBlockHeights.length == 0) {
      stateDB.setValue(this.chainName, blockNumber);
    }
    else {
      if (this.messageBlockHeights[0].height > blockNumber) {
        stateDB.setValue(self.chainName, blockNumber);
      }
      else {
        logger.info('Message waiting to be finalized', this.messageBlockHeights[0].nonce);
      }
    }
  }

  async tryTrigger() {
    let ret = await ethereum.contractCall(this.omniverseContractContract, 'getExecutableDelayedTx', []);
    if (ret.sender != '0x') {
      logger.debug('Delayed transaction', ret);
      let receipt = await ethereum.sendTransaction(this.web3, this.chainId, this.omniverseContractContract, 'triggerExecution',
        this.testAccountPrivateKey, []);
      if (!receipt) {
        logger.debug('receipt', receipt);
      }
      else {
        logger.debug(receipt.logs[0].topics, receipt.logs[0].data);
        for (let i = 0; i < receipt.logs.length; i++) {
          let log = receipt.logs[i];
          if (log.address == this.omniverseContractContract._address) {
            if (log.topics[0] == this.eventOmniverseTokenTransfer.signature) {
              let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenTransfer.inputs, log.data, log.topics.slice(1));
              logger.info(utils.format('Execute OmniverseTransfer successfully: {0} transfer {1} to {2}.',
                decodedLog.from, decodedLog.value, decodedLog.to));
            }
          }
        }
      }
    }
  }

  generalizeData(payload) {
    let ret = {};
    let opData = this.web3.eth.abi.decodeParameters(this.payloadCfg.types, payload);
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      if (this.payloadCfg.types[i] == 'bytes') {
        ret[this.payloadCfg.keys[i]] = utils.toByteArray(opData[i]);
      }
      else {
        ret[this.payloadCfg.keys[i]] = opData[i];
      }
    }

    return ret;
  }

  async messageFinalized(from, nonce) {
    let height;
    for (let i = 0; i < this.messageBlockHeights.length; i++) {
      if (this.messageBlockHeights[i].from == from && this.messageBlockHeights[i].nonce == nonce) {
        height = this.messageBlockHeights[i].height;
        this.messageBlockHeights.splice(i, 1);
        break;
      }
    }

    if (!height) {
      logger.error('The block height should not be null');
      return;
    }

    global.stateDB.setValue(this.chainName, height + 1);
  }

  async start(cbHandler) {
    let fromBlock = stateDB.getValue(this.chainName);
    let blockNumber = await this.web3.eth.getBlockNumber();
    if (!fromBlock) {
      fromBlock = 'latest';
    }
    else {
      if (blockNumber - fromBlock > globalDefine.LogRange) {
        logger.info('Exceed max log range, subscribe from the latest');
        fromBlock = 'latest'
      }
    }
    logger.info(this.chainName, 'Block height', fromBlock);
    this.omniverseContractContract.events.TransactionSent({
      fromBlock: fromBlock
    })
    .on("connected", (subscriptionId) => {
      logger.info('TransactionSent connected', subscriptionId);
    })
    .on('data', async (event) => {
      logger.debug('TransactionSent event', event);
      // to be continued, decoding is needed here for omniverse
      console.log(event.returnValues.pk, event.returnValues.nonce);
      let message = await ethereum.contractCall(this.omniverseContractContract, 'transactionCache', [event.returnValues.pk]);
      if (message.timestamp != 0 && event.returnValues.nonce == message.txData.nonce) {
        console.log('Got cached transaction', this.chainName);
      }
      else {
        let messageCount = await ethereum.contractCall(this.omniverseContractContract, 'getTransactionCount', [event.returnValues.pk]);
        if (messageCount > event.returnValues.nonce) {
          message = await ethereum.contractCall(this.omniverseContractContract, 'getTransactionData', [event.returnValues.pk, event.returnValues.nonce]);
        }
        else {
          console.log('No transaction got', this.chainName);
          return;
        }
      }
      let members = await ethereum.contractCall(this.omniverseContractContract, 'getMembers', []);
      let data = this.generalizeData(message.txData.payload);
      let m = {
        nonce: message.txData.nonce,
        chainId: message.txData.chainId,
        initiateSC: message.txData.initiateSC,
        from: message.txData.from,
        payload: data,
        signature: message.txData.signature,
      }
      this.messageBlockHeights.push({
        from: event.returnValues.pk,
        nonce: event.returnValues.nonce,
        height: event.blockNumber
      });
      cbHandler.onMessageSent(this.omniverseChainId, m, members);
    })
    .on('changed', (event) => {
      // remove event from local database
      logger.info('TransactionSent changed');
      logger.debug(event);
    })
    .on('error', (error, receipt) => {
      // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      logger.info('TransactionSent error', this.chainName, error);
      logger.info('TransactionSent receipt', receipt);
    });

    this.omniverseContractContract.events.TransactionExecuted()
    .on("connected", (subscriptionId) => {
      logger.info('TransactionExecuted connected', subscriptionId);
    })
    .on('data', async (event) => {
      logger.debug('TransactionExecuted event', event);
      // to be continued, decoding is needed here for omniverse
      cbHandler.onMessageExecuted(this.omniverseChainId, event.returnValues.pk, event.returnValues.nonce);
    })
    .on('changed', (event) => {
      // remove event from local database
      logger.info('TransactionExecuted changed');
      logger.debug(event);
    })
    .on('error', (error, receipt) => {
      // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      logger.info('TransactionExecuted error', this.chainName, error);
      logger.info('TransactionExecuted receipt', receipt);
    });
  }

  getProvider() {
    return this.web3;
  }
}

module.exports = EthereumHandler;