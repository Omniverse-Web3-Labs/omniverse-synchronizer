'use strict';

const config = require('config');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const bitcoin = require('./bitcoin.js');

class BitcoinHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "bitcoin"));
    
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];

    this.omniverseChainId = config.get('networks.' + this.chainName + '.omniverseChainId');
    this.messages = [];

    this.payloadCfg = config.get('payload');
  }

  async addMessageToList(message) {
    let params = {};
    for (let i in this.payloadCfg.keys) {
      let key = this.payloadCfg.keys[i];
      let value = message.payload[key];
      if (key == 'bytes') {
        params[key] = (Buffer.from(value).toString('hex'));
      }
      else {
        params[key] = value;
      }
    }
    
    this.messages.push({
        nonce: message.nonce,
        initiateSC: message.initiateSC,
        from: message.from,
        chainId: message.chainId,
        payload: params,
        signature: message.signature,
      });
  }

  async pushMessages(cbHandler) {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      // inscribe
      global.logger.debug('push message', message);
      await bitcoin.sendOmniverseTransaction(message);
      cbHandler.onMessageExecuted(this.omniverseChainId, message.from, message.nonce);
    }
  }

  async update() {
  }

  async beforeRestore() {
  }

  async restore(pendings, cbHandler) {
  }

  async tryTrigger() {
  }

  async messageFinalized(from, nonce) {
    logger.warn(this.chainName, 'messageFinalized should not be triggered');
  }

  async start(cbHandler) {
  }

  getProvider() {
  }
}

module.exports = BitcoinHandler;