'use strict';

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const config = require('config');
const substrate = require('./substrate.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const globalDefine = require('../../utils/globalDefine.js');
const { u8, u128, Struct, Vector, Bytes } = require('scale-ts');

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
    logger.info(
      utils.format(
        'Init handler: {0}, compatible chain: {1}',
        this.chainName,
        'substrate'
      )
    );
    this.network = config.get('networks.' + this.chainName);
    const wsProvider = new WsProvider(this.network.nodeAddress);
    this.api = await ApiPromise.create({ provider: wsProvider });
    this.tokenId = config.get('tokenId');

    // key
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    const keyring = new Keyring({ type: 'sr25519' });
    // private key
    if (typeof secret[this.chainName] == 'string') {
      this.sender = keyring.addFromSeed(secret[this.chainName]);
    } else {
      this.sender = keyring.addFromJson(
        JSON.parse(secret[this.chainName].backup)
      );
      this.sender.decodePkcs8(secret[this.chainName].password);
    }

    this.messages = [];
  }

  async addMessageToList(message) {
    let opData;
    if (message.data.op == globalDefine.TokenOpType.TRANSFER) {
      let data = TransferTokenOp.enc({
        to: new Uint8Array(Buffer.from(message.data.to)),
        amount: BigInt(message.data.amount),
      });
      opData = TokenOpcode.enc({
        op: message.data.op,
        data: Array.from(data),
      });
    } else if (message.data.op == globalDefine.TokenOpType.MINT) {
      let data = MintTokenOp.enc({
        to: new Uint8Array(Buffer.from(message.data.to)),
        amount: BigInt(message.data.amount),
      });
      opData = TokenOpcode.enc({
        op: message.data.op,
        data: Array.from(data),
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
      let message = this.messages[i];
      let nonce = await substrate.contractCall(
        this.api,
        'omniverseProtocol',
        'transactionCount',
        message.from
      );
      if (nonce == message.nonce) {
        await substrate.sendTransaction(
          this.api,
          'assets',
          'sendTransaction',
          this.sender,
          [this.tokenId, message]
        );
        this.messages.splice(i, 1);
        break;
      }
    }
  }

  async tryTrigger() {}

  async getOmniverseEvent(blockHash, callback) {
    const apiAt = await this.api.at(blockHash);
    await apiAt.query.system.events((events) => {
      console.log(`Received ${events.length} events:`);

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
          // console.log(event.data[0], event.data[1]);
          let message = await substrate.contractCall(
            this.api,
            'omniverseProtocol',
            'transactionRecorder',
            [
              event.data[0].toHuman(),
              [event.data[1].toHuman(), event.data[2].toHuman()],
            ]
          );
          let tokenInfo = await substrate.contractCall(
            this.api,
            'assets',
            'tokensInfo',
            [this.tokenId]
          );
          // console.log('message', message.unwrap(), tokenInfo.unwrap());
          let m = message.unwrap().txData.toJSON();
          if (event.data[1].toHuman() != this.tokenId) {
            console.log('Another destination');
            return;
          }
          console.log(m);
          let data = this.generalizeData(m);
          m.data = data;
          callback(m, tokenInfo.unwrap().members.toHuman());
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
    ret.op = Number(data.opType);
    ret.to = utils.toByteArray(data.opData);
    ret.amount = data.amount
    // let ret.op = data.
    // let tokenOp = TokenOpcode.dec(data);
    // ret.op = tokenOp.op;
    // if (Number(data.opType) == globalDefine.TokenOpType.MINT) {
    //   let mintOp = MintTokenOp.dec(new Uint8Array(tokenOp.data));
    //   ret.to = Array.from(mintOp.to);
    //   ret.amount = mintOp.amount;
    // } else if (Number(data.opType) == globalDefine.TokenOpType.TRANSFER) {
    //   let transferOp = TransferTokenOp.dec(new Uint8Array(tokenOp.data));
    //   ret.to = Array.from(transferOp.to);
    //   ret.amount = transferOp.amount;
    // }

    return ret;
  }

  async start(callback) {
    const unsubscribe = await this.api.rpc.chain.subscribeNewHeads(
      async (header) => {
        console.log(`\nChain is at block: #${header.number}`);
        let hash = await this.api.rpc.chain.getBlockHash(
          header.number.toNumber()
        );
        console.log('Block hash:', hash.toHuman());

        await this.getOmniverseEvent(hash, callback);
      }
    );
  }

  getProvider() {
    return this.api;
  }
}

module.exports = SubstrateHandler;
