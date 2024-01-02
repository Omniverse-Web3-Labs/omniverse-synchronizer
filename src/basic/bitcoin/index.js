'use strict';

const config = require('config');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const bitcoin = require('./bitcoin.js');
const {bitcoin: btc, inscription} = require('@hthuang/bitcoin-lib/dist/index');

class BitcoinHandler {
  constructor(chainName) {
    let networkType = config.get(`networks.${chainName}.networkType`);
    if (networkType == 'regtest') {
      inscription.setNetwork(inscription.Network.Regtest);
    }
    else if (networkType == 'testnet') {
      inscription.setNetwork(inscription.Network.Testnet);
    }
    else if (networkType == 'mainnet') {
      inscription.setNetwork(inscription.Network.Mainnet);
    }
    this.chainName = chainName;
  }

  async init(hdMgr) {
    this.hdMgr = hdMgr;
    this.logger = logger.getLogger(this.chainName.toLowerCase());
    this.logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "bitcoin"));
    
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];

    this.omniverseChainId = config.get('networks.' + this.chainName + '.omniverseChainId');
    this.messages = [];

    this.payloadCfg = config.get('payload');

    btc.setProvider(config.get(`networks.${this.chainName}.url`));
  }

  async addMessageToList(message, tokenId) {
    let params = {};
    for (let i in this.payloadCfg.keys) {
      let key = this.payloadCfg.keys[i];
      let value = message.payload[key];
      if (this.payloadCfg.types[i] == 'bytes') {
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
        tokenId,
      });
  }

  async pushMessages(cbHandler) {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      let nonce = await utils.syncRequest(config.get(`networks.${this.chainName}.server`) + `api/getTransactionCount?pk=${message.from}`, 'GET');
      this.logger.info('nonce', nonce);
      if (parseInt(nonce.result) >= parseInt(message.nonce)) {
        // inscribe
        this.logger.debug('push bitcoin message', message);
        await bitcoin.sendOmniverseTransaction(message);
        cbHandler.onMessageExecuted(this.omniverseChainId, message.from, message.nonce, message.tokenId);
        this.messages.splice(i, 1);
      }
      else {
        this.logger.info('Caching');
      }
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
    this.logger.warn(this.chainName, 'messageFinalized should not be triggered');
  }

  async start(cbHandler) {
  }

  getProvider() {
  }
}

module.exports = BitcoinHandler;
