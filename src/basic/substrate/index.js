'use strict';

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const config = require('config');
const substrate = require('./substrate.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const globalDefine = require('../../utils/globalDefine.js');
const { bool, _void, str, u8, u16, u32, u64, u128, i8, i16, i32, i64, i128, Enum, Struct, Vector, Option, Bytes } = require('scale-ts');

const TokenOpcode = Struct({
  op: u8,
  data: Vector(u8),
});

const MintTokenOp = Struct({
  to: Bytes(64),
  amount: u128,
});

const TransferTokenOp = Struct({
  to: Bytes(64),
  amount: u128,
});

class SubstrateHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "substrate"));
    this.network = config.get('networks.' + this.chainName);
    const wsProvider = new WsProvider(this.network.nodeAddress);
    this.api = await ApiPromise.create({ provider: wsProvider });
    this.tokenId = config.get('tokenId');
    
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
    let opData;
    if (message.data.op == globalDefine.TokenOpType.TRANSFER) {
      let data = TransferTokenOp.enc({
        to: new Uint8Array(Buffer.from(message.data.to)),
        amount: BigInt(message.data.amount)
      });
      opData = TokenOpcode.enc({
        op: message.data.op,
        data: Array.from(data)
      });
    }
    else if (message.data.op == globalDefine.TokenOpType.MINT) {
      let data = MintTokenOp.enc({
        to: new Uint8Array(Buffer.from(message.data.to)),
        amount: BigInt(message.data.amount)
      });
      opData = TokenOpcode.enc({
        op: message.data.op,
        data: Array.from(data)
      });
    }

    this.messages.push({
      nonce: message.nonce,
      from: message.from,
      to: message.to,
      chainId: message.chainId,
      data: utils.toHexString(Array.from(opData)),
      signature: message.signature,
    });
  }

  async pushMessages() {
    for (let i = 0; i < this.messages.length; i++) {
      await substrate.sendTransaction(this.api, 'omniverseFactory', 'sendTransaction',
      this.sender, [this.tokenId, this.messages[i]]);
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
                let tokenInfo = await substrate.contractCall(this.api, 'omniverseFactory', 'tokensInfo', [this.tokenId]);
                console.log('message', message.unwrap(), tokenInfo.unwrap());
                let m = message.unwrap().txData.toHuman();
                if (m.to != this.tokenId) {
                  console.log('Another destination');
                  return;
                }
                let data = this.generalizeData(m.data);
                m.data = data;
                callback(m, utils.toByteArray(tokenInfo.unwrap().members.toHuman()));
            }
        });
    });
  }

  /*
  ret: {
    op: number,
    to: array,
    amount: big int
  }
  */
  generalizeData(data) {
    let ret = {};
    let tokenOp = TokenOpcode.dec(data);
    ret.op = tokenOp.op;
    if (tokenOp.op == globalDefine.TokenOpType.MINT) {
      let mintOp = MintTokenOp.dec(new Uint8Array(tokenOp.data));
      ret.to = Array.from(mintOp.to);
      ret.amount = mintOp.amount;
    }
    else if (tokenOp.op == globalDefine.TokenOpType.TRANSFER) {
      let transferOp = MintTokenOp.dec(tokenOp.data);
      ret.to = Array.from(transferOp.to);
      ret.amount = transferOp.amount;
    }

    return ret;
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