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

const Fungible = Struct({
  op: u8,
  ex_data: Vector(u8),
  amount: u128,
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
    this.messageBlockHeights = [];
    this.network = config.get('networks.' + this.chainName);
    this.omniverseChainId = config.get(
      'networks.' + this.chainName + '.omniverseChainId'
    );
    const wsProvider = new WsProvider(this.network.nodeAddress);
    this.api = await ApiPromise.create({ provider: wsProvider });
    this.tokenId = config.get('networks.' + this.chainName + '.tokenId');

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
    // let opData;
    // if (message.data.op == globalDefine.TokenOpType.TRANSFER) {
    //   let data = TransferTokenOp.enc({
    //     to: new Uint8Array(Buffer.from(message.data.to)),
    //     amount: BigInt(message.data.amount),
    //   });
    //   opData = TokenOpcode.enc({
    //     op: message.data.op,
    //     data: Array.from(data),
    //   });
    // } else if (message.data.op == globalDefine.TokenOpType.MINT) {
    //   let data = MintTokenOp.enc({
    //     to: new Uint8Array(Buffer.from(message.data.to)),
    //     amount: BigInt(message.data.amount),
    //   });
    //   opData = TokenOpcode.enc({
    //     op: message.data.op,
    //     data: Array.from(data),
    //   });
    // }

    let payload = Fungible.enc({
      op: message.payload.op,
      ex_data: message.payload.exData,
      amount: BigInt(message.payload.amount),
    });

    this.messages.push({
      nonce: message.nonce,
      chainId: message.chainId,
      initiatorAddress: message.initiateSC,
      from: message.from,
      payload: utils.toHexString(Array.from(payload)),
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
        [message.from, this.tokenId]
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

  async tryTrigger() {
    let [delayedExecutingIndex, delayedIndex] = (
      await substrate.contractCall(this.api, 'assets', 'delayedIndex', [])
    ).toJSON();
    if (delayedExecutingIndex < delayedIndex) {
      await substrate.sendTransaction(
        this.api,
        'assets',
        'triggerExecution',
        this.sender,
        []
      );
    }
  }

  async getOmniverseEvent(blockHash, cbHandler) {
    const apiAt = await this.api.at(blockHash);
    const blockNumber = (await apiAt.query.system.number()).toJSON();
    await apiAt.query.system.events((events) => {
      // console.log(`Received ${events.length} events:`);

      // Loop through the Vec<EventRecord>
      events.forEach(async (record) => {
        // Extract the phase, event and the event types
        const { event } = record;
        // Show what we are busy with
        if (event.section == 'assets') {
          if (event.method == 'TransactionSent') {
            // event.data.forEach((data, index) => {
            // });
            // console.log(`${event.section}:${event.method}`);
            // console.log(event.data.toJSON());
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
            let payload = this.generalizeData(m);
            m.payload = payload;
            m.initiateSC = m.initiatorAddress;
            delete m.initiatorAddress;
            let mb = tokenInfo.unwrap().members.toHuman();
            let members = [];
            for (let member of mb) {
              members.push({
                chainId: member[0],
                contractAddr: member[1],
              });
            }
            this.messageBlockHeights.push({
              from: m.from,
              nonce: m.nonce,
              height: blockNumber,
            });
            cbHandler.onMessageSent(this.omniverseChainId, m, members);
          } else if (event.method == 'TransactionExecuted') {
            logger.debug('TransactionExecuted event', event.data.toJSON());
            cbHandler.onMessageExecuted(
              this.omniverseChainId,
              event.data[0].toHuman(),
              event.data[1].toHuman()
            );
          }
        }
      });
    });
  }

  async messageFinalized(from, nonce) {
    let height;
    for (let i = 0; i < this.messageBlockHeights.length; i++) {
      if (
        this.messageBlockHeights[i].from == from &&
        this.messageBlockHeights[i].nonce == nonce
      ) {
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

  /*
  ret: {
    op: number,
    to: array,
    amount: big int
  }
  */
  generalizeData(data) {
    let ret = {};
    // ret.op = Number(data.opType);
    // ret.exData = utils.toByteArray(data.opData);
    // ret.amount = data.amount
    let fungible = Fungible.dec(data.payload);
    ret.op = fungible.op;
    ret.exData = Array.from(fungible.ex_data);
    ret.amount = fungible.amount;
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

  async processPastOmniverseEvent(startBlock, currentBlockNumber, cbHandler) {
    for (; startBlock < currentBlockNumber; ++startBlock) {
      let hash = await this.api.rpc.chain.getBlockHash(startBlock);
      await this.getOmniverseEvent(hash, cbHandler);
    }
    this.messageBlockHeights = [];
  }

  async start(cbHandler) {
    let fromBlock = stateDB.getValue(this.chainName);
    let currentBlock = await this.api.rpc.chain.getBlock();
    let currentBlockNumber = currentBlock.block.header.number.toJSON();
    console.log(currentBlockNumber - fromBlock )
    if (fromBlock && currentBlockNumber - fromBlock < 256) {
      await this.processPastOmniverseEvent(fromBlock, currentBlockNumber, cbHandler);
    }
    await this.api.rpc.chain.subscribeNewHeads(async (header) => {
      console.log(`\nChain is at block: #${header.number}`);
      let hash = await this.api.rpc.chain.getBlockHash(
        header.number.toNumber()
      );
      console.log('Block hash:', hash.toHuman());

      await this.getOmniverseEvent(hash, cbHandler);
    });
  }

  async update() {
    let currentBlock = await this.api.rpc.chain.getBlock();
    let currentBlockNumber = currentBlock.block.header.number.toJSON();
    if (this.messageBlockHeights.length == 0) {
      stateDB.setValue(this.chainName, currentBlockNumber);
    } else {
      if (this.messageBlockHeights[0].height > currentBlockNumber) {
        stateDB.setValue(self.chainName, currentBlockNumber);
      } else {
        logger.info('Message waiting to be finalized');
      }
    }
  }

  getProvider() {
    return this.api;
  }
}

module.exports = SubstrateHandler;
