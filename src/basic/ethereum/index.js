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
        delay: 1000, // ms
        maxAttempts: 5,
        onTimeout: false
      }
    };
    this.messageBlockHeights = [];
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
    this.payloadCfg = config.get('payload');
    this.messages = [];

    for (let i = 0; i < skywalkerFungibleAbi.length; i++) {
      if (skywalkerFungibleAbi[i].type == 'event' && skywalkerFungibleAbi[i].name == OMNIVERSE_TOKEN_TRANSFER) {
        this.eventOmniverseTokenTransfer = skywalkerFungibleAbi[i];
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
      let nonce = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionCount', [message.from]);
      if (nonce == message.nonce) {
        let txData = await ethereum.contractCall(this.skywalkerFungibleContract, 'transactionCache', [message.from]);
        if (txData.timestamp == 0) {
          await ethereum.sendTransaction(this.web3, this.chainId, this.skywalkerFungibleContract, 'sendOmniverseTransaction',
            this.testAccountPrivateKey, [this.messages[i]]);
          this.messages.splice(i, 1);
          break;
        }
        else {
          log.info('Cooling down');
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
      if (!receipt) {
        logger.debug('receipt', receipt);
      }
      else {
        logger.debug(receipt.logs[0].topics, receipt.logs[0].data);
        for (let i = 0; i < receipt.logs.length; i++) {
          let log = receipt.logs[i];
          if (log.address == this.skywalkerFungibleContract._address) {
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

    global.stateDB.setValue(this.chainName, height);
  }

  async start(cbHandler) {
    // let param1 = '0xfb73e1e37a4999060a9a9b1e38a12f8a7c24169caa39a2fb304dc3506dd2d797f8d7e4dcd28692ae02b7627c2aebafb443e9600e476b465da5c4dddbbc3f2782';
    // let param2 = 8;
    // let transactionCount = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionCount', [param1]);
    // if (param2 >= transactionCount) {
    //   console.log('Nonce error', this.chainName, transactionCount);
    //   return;
    // }
    // else {
    //   console.log('Nonce right', this.chainName);
    // }
    // let message = await ethereum.contractCall(this.skywalkerFungibleContract, 'getTransactionData', [param1, param2]);
    // let members = await ethereum.contractCall(this.skywalkerFungibleContract, 'getMembers', []);
    // let data = this.generalizeData(message.txData.payload);
    // let m = {
    //   nonce: message.txData.nonce,
    //   chainId: message.txData.chainId,
    //   initiateSC: message.txData.initiateSC,
    //   from: message.txData.from,
    //   payload: data,
    //   signature: message.txData.signature,
    // }
    // cbHandler.onMessageSent(m, members);
    // return;
    let fromBlock = stateDB.getValue(this.chainName);
    if (!fromBlock) {
      fromBlock = 'latest';
    }
    this.skywalkerFungibleContract.events.TransactionSent()
    .on("connected", (subscriptionId) => {
      logger.info('TransactionSent connected', subscriptionId);
    })
    .on('data', async (event) => {
      logger.debug('TransactionSent event', event);
      // to be continued, decoding is needed here for omniverse
      console.log(event.returnValues.pk, event.returnValues.nonce);
      let message = await ethereum.contractCall(this.skywalkerFungibleContract, 'transactionCache', [event.returnValues.pk]);
      if (message.timestamp != 0 && event.returnValues.nonce == message.txData.nonce) {
        console.log('Got cached transaction', this.chainName);
      }
      else {
        console.log('No cached transaction', this.chainName);
        return;
      }
      let members = await ethereum.contractCall(this.skywalkerFungibleContract, 'getMembers', []);
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
      cbHandler.onMessageSent(m, members);
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

    this.skywalkerFungibleContract.events.TransactionExecuted()
    .on("connected", (subscriptionId) => {
      logger.info('TransactionExecuted connected', subscriptionId);
    })
    .on('data', async (event) => {
      logger.debug('TransactionExecuted event', event);
      // to be continued, decoding is needed here for omniverse
      cbHandler.onMessageExecuted(event.returnValues.pk, event.returnValues.nonce);
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