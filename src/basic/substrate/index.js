'use strict';

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const config = require('config');
const substrate = require('./substrate.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');

class SubstrateHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "substrate"));
    this.network = config.get('networks.' + this.chainName);
    const wsProvider = new WsProvider(this.network.nodeAddress);
    this.api = await ApiPromise.create({ provider: wsProvider });
    
    // key
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    const keyring = new Keyring({ type: 'sr25519' });
    // private key
    if (typeof(secret[this.chainName]) == 'string') {
      this.sender = keyring.addFromSeed(secret[this.chainName]);
    }
    else {
      this.sender = keyring.addFromJson(JSON.parse(secret[this.chainName].backup));
      this.sender.decodePkcs8(secret[this.chainName].password);
    }
    
    this.messages = [];
  }

  async addMessageToList(message) {
    // to be continued, encoding is needed here for omniverse
    this.messages.push(message);
  }

  async pushMessages() {
    for (let i = 0; i < this.messages.length; i++) {
      await substrate.sendTransaction(this.api, 'omniverseFactory', 'sendTransaction',
      this.sender, [this.messages[i]]);
    }
    this.messages = [];
  }

  async tryTrigger() {
  }

  async getOmniverseEvent(blockHash, callback) {
    const apiAt = await this.api.at(blockHash);
    await apiAt.query.system.events((events) => {
        // console.log(`Received ${events.length} events:`);
    
        // Loop through the Vec<EventRecord>
        events.forEach(async (record) => {
            // Extract the phase, event and the event types
            const { event, phase } = record;
            const types = event.typeDef;

            // Show what we are busy with
            if (event.section == 'omniverseProtocol') {
                // console.log(`\t${event.section}:${event.method}:: (phase=${phase.toString()})`);
                // console.log(`\t\t${event.meta.docs.toString()}`);

                // Loop through each of the parameters, displaying the type and data
                event.data.forEach((data, index) => {
                    // console.log(`\t\t\t${types[index].type}: ${data.toString()}`);
                });
                console.log(event.data[0], event.data[1]);
                let message = await substrate.contractCall(this.api, 'omniverseProtocol', 'transactionRecorder', [event.data[0].toHuman(), event.data[1].toHuman()]);
                let tokenInfo = await substrate.contractCall(this.api, 'omniverseFactory', 'tokensInfo', ['0x01']);
                console.log('message', message.unwrap(), tokenInfo.unwrap());
                callback(message.unwrap().txData.toHuman(), tokenInfo.unwrap().members.toHuman());
            }
        });
    });
  }

  async start(callback) {
    const unsubscribe = await this.api.rpc.chain.subscribeNewHeads(async (header) => {
        console.log(`\nChain is at block: #${header.number}`);
        let hash = await this.api.rpc.chain.getBlockHash(header.number.toNumber());
        console.log('Block hash:', hash.toHuman());
    
        await this.getOmniverseEvent(hash, callback);
      });
  }

  getProvider() {
    return this.api;
  }
}

module.exports = SubstrateHandler;