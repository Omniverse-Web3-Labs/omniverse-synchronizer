'use strict';

const Web3 = require('web3');
const config = require('config');
const ethereum = require('./ethereum.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');

const EXECUTE_FAILED = 'ExecuteFailed';
const MESSAGE_EXECUTED = 'MessageExecuted';

class EthereumHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "ethereum"));
    this.web3 = new Web3(config.get('networks.' + this.chainName + '.nodeAddress'));
    this.web3.eth.handleRevert = true;
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];
    // OmniverseProtocol
    let omniverseProtocolContractAddress = config.get('networks.' + this.chainName + '.omniverseProtocolContractAddress');
    let omniverseProtocolRawData = fs.readFileSync(config.get('networks.' + this.chainName + '.omniverseProtocolAbiPath'));
    let omniverseProtocolAbi = JSON.parse(omniverseProtocolRawData).abi;
    this.omniverseProtocolContract = new this.web3.eth.Contract(omniverseProtocolAbi, omniverseProtocolContractAddress);
    // SkywalkerFungible
    let skywalkerFungibleContractAddress = config.get('networks.' + this.chainName + '.skywalkerFungibleContractAddress');
    let skywalkerFungibleRawData = fs.readFileSync(config.get('networks.' + this.chainName + '.omniverseProtocolAbiPath'));
    let skywalkerFungibleAbi = JSON.parse(skywalkerFungibleRawData).abi;
    this.skywalkerFungibleContract = new this.web3.eth.Contract(skywalkerFungibleAbi, skywalkerFungibleContractAddress);
    this.chainId = config.get('networks.' + this.chainName + '.chainId');
    this.messages = [];
  }

  async addMessageToList(message) {
    // to be continued, encoding is needed here for omniverse
    this.messages.push(message);
  }

  async pushMessages() {
    for (let i = 0; i < this.messages.length; i++) {
      await ethereum.sendTransaction(this.web3, this.chainId, this.skywalkerFungibleContract, 'omniverseTransfer',
        this.testAccountPrivateKey, [message[i]]);
    }
    this.messages = [];
  }

  async tryTrigger() {
    while (true) {
      let ret = await ethereum.contractCall(this.skywalkerFungibleContract, 'getExecutableDelayedTx', []);
      if (ret.sender != '0x') {
        await ethereum.sendTransaction(this.web3, this.chainId, this.skywalkerFungibleContract, 'triggerExecution',
          this.testAccountPrivateKey, []);
      }
      else {
        break;
      }
    }
  }

  start(callback) {
    this.omniverseProtocolContract.events.TransactionSent()
    .on("connected", function(subscriptionId){
      logger.info('connected', subscriptionId);
    })
    .on('data', function(event){
      logger.debug('event', event);
      // to be continued, decoding is needed here for omniverse
      let message = await ethereum.contractCall(this.omniverseProtocolContract, 'getTransactionData', [event.returnValues.pk, event.returnValues.nonce]);
      let members = await ethereum.contractCall(this.skywalkerFungibleContract, 'getMembers', []);
      callback(message, members);
    })
    .on('changed', function(event){
      // remove event from local database
      logger.info('changed');
      logger.debug(event);
    })
    .on('error', function(error, receipt) {
      // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      logger.info('error', error);
      logger.info(receipt);
    });
  }

  getProvider() {
    return this.web3;
  }
}

module.exports = EthereumHandler;