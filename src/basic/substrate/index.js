'use strict';

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const config = require('config');
const substrate = require('./substrate.js');
const fs = require('fs');
const utils = require('../../utils/utils.js');
const logger = require('../../utils/logger.js');
const { u8, u128, Struct, Vector } = require('scale-ts');
const { queue } = require('async');

const Assets = Struct({
  op: u8,
  exData: Vector(u8),
  amount: u128,
});

class SubstrateHandler {
  constructor(chainName) {
    this.chainName = chainName;
    this.queue = queue(substrate.substrateTxWorker, 1);
  }

  async init() {
    logger.info(
      utils.format(
        'Init handler: {0}, compatible chain: {1}',
        this.chainName,
        'substrate'
      )
    );
    this.restoreBlockHeight = 0;
    this.messageBlockHeights = [];
    this.network = config.get('networks.' + this.chainName);
    this.omniverseChainId = config.get(
      'networks.' + this.chainName + '.omniverseChainId'
    );
    const wsProvider = new WsProvider(this.network.nodeAddress);
    this.api = await ApiPromise.create({ provider: wsProvider });
    // this.tokenId = config.get('networks.' + this.chainName + '.tokenId');
    this.pallets = config.get('networks.' + this.chainName + '.pallets');

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
    let payload = Assets.enc({
      op: message.payload.op,
      exData: message.payload.exData,
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
      for (let palletName of this.pallets) {
        let message = this.messages[i];
        let tokenId = (
          await substrate.contractCall(
            this.api,
            palletName,
            'tokenIdofMember',
            [[message.chainId, message.initiatorAddress]]
          )
        ).toHuman();
        if (tokenId) {
          let nonce = (
            await substrate.contractCall(
              this.api,
              'omniverseProtocol',
              'transactionCount',
              [message.from, palletName, tokenId]
            )
          ).toString();
          // nonce = nonce.toJSON();
          if (nonce >= message.nonce) {
            if (nonce > message.nonce) {
              // message exists
              let hisData = (
                await substrate.contractCall(
                  this.api,
                  'omniverseProtocol',
                  'transactionRecorder',
                  [message.from, palletName, tokenId, message.nonce]
                )
              )
                .unwrap()
                .txData.toJSON();
              logger.debug('hisData', hisData);
              let bCompare =
                hisData.nonce == message.nonce &&
                hisData.chainId == message.chainId &&
                hisData.initiatorAddress == message.initiateSC &&
                hisData.from == message.from &&
                hisData.payload == message.payload &&
                hisData.signature == message.signature;
              if (bCompare) {
                this.messages.splice(i, 1);
                logger.debug(
                  utils.format(
                    'The message of pk {0}, nonce {1} has been executed on chain {2}',
                    message.from,
                    message.nonce,
                    this.chainName
                  )
                );
                cbHandler.onMessageExecuted(
                  this.omniverseChainId,
                  message.from,
                  message.nonce
                );
                return;
              }
            }

            // await substrate.sendTransaction(
            //   this.api,
            //   palletName,
            //   'sendTransaction',
            //   this.sender,
            //   [tokenId, message]
            // );
            let result = await substrate.enqueueTask(
              this.queue,
              this.api,
              palletName,
              'sendTransaction',
              this.sender,
              [tokenId, message]
            );
            if (result) {
              this.messages.splice(i, 1);
            }
            return;
          }
        }
      }
    }
  }

  async beforeRestore() {
    this.restoreBlockHeight = await this.api.rpc.chain.getBlock();
  }

  async restore(pendings, cbHandler) {
    for (let i = 0; i < pendings.length; i++) {
      let checkItem = (item) => {
        return item[0] == this.chainName;
      };

      let item = pendings[i].chains.find(checkItem);
      if (item) {
        logger.debug(
          utils.format(
            'Transaction has been pushed to chain {0}',
            this.chainName
          )
        );
        let pk = pendings[i].pk;
        let tokenId = this.network.tokenId;
        let nonce = pendings[i].nonce;
        let palletName = this.network.pallets[0];
        let message = await substrate.contractCall(
          this.api,
          'omniverseProtocol',
          'transactionRecorder',
          [pk, palletName, tokenId, nonce]
        );

        let tokenInfo = await substrate.contractCall(
          this.api,
          palletName,
          'tokensInfo',
          [tokenId]
        );

        let m = message.unwrap().txData.toJSON();
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
        if (cbHandler.onMessageSent(this.omniverseChainId, m, members)) {
          this.messageBlockHeights.push({
            from: m.from,
            nonce: m.nonce,
            height: item[1],
          });
        }
      } else {
        logger.debug(
          utils.format(
            'Transaction has not been pushed to chain {0}',
            this.chainName
          )
        );
      }
    }
  }

  async tryTrigger() {
    for (let palletName of this.pallets) {
      let [delayedExecutingIndex, delayedIndex] = (
        await substrate.contractCall(this.api, palletName, 'delayedIndex', [])
      ).toJSON();
      if (delayedExecutingIndex < delayedIndex) {
        let delayedTx = (
          await substrate.contractCall(
            this.api,
            palletName,
            'delayedTransactions',
            [delayedExecutingIndex]
          )
        ).toJSON();
        let tokenInfo = (
          await substrate.contractCall(this.api, palletName, 'tokensInfo', [
            delayedTx.tokenId,
          ])
        ).toJSON();
        let omniTx = (
          await substrate.contractCall(
            this.api,
            'omniverseProtocol',
            'transactionRecorder',
            [delayedTx.sender, palletName, delayedTx.tokenId, delayedTx.nonce]
          )
        ).toJSON();
        let currentTime = new Date().getTime() / 1000;
        if (currentTime >= omniTx.timestamp + tokenInfo.cooldownTime) {
          await substrate.enqueueTask(
            this.queue,
            this.api,
            palletName,
            'triggerExecution',
            this.sender,
            []
          );
        }
      }
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
        this.pallets.forEach(async (palletName) => {
          if (event.section == palletName) {
            if (event.method == 'TransactionSent') {
              let pk = event.data[0].toHuman();
              let tokenId = event.data[1].toHuman();
              let nonce = event.data[2].toHuman();
              let message = await substrate.contractCall(
                this.api,
                'omniverseProtocol',
                'transactionRecorder',
                [pk, palletName, tokenId, nonce]
              );

              let tokenInfo = await substrate.contractCall(
                this.api,
                palletName,
                'tokensInfo',
                [tokenId]
              );

              let m = message.unwrap().txData.toJSON();
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
              if (cbHandler.onMessageSent(this.omniverseChainId, m, members)) {
                this.messageBlockHeights.push({
                  from: m.from,
                  nonce: m.nonce,
                  height: blockNumber,
                });
              }
            } else if (
              event.method == 'TransactionExecuted' ||
              event.method == 'TransactionDuplicated'
            ) {
              logger.debug(
                event.method + ' event',
                this.omniverseChainId,
                event.data.toJSON()
              );
              cbHandler.onMessageExecuted(
                this.omniverseChainId,
                event.data[0].toHuman(),
                event.data[1].toHuman()
              );
            }
          }
        });
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
      // logger.error('The block height should not be null');
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
    let assets = Assets.dec(data.payload);
    ret.op = assets.op;
    ret.exData = Array.from(assets.exData);
    ret.amount = assets.amount;
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
    let fromBlock = this.restoreBlockHeight || stateDB.getValue(this.chainName);
    let currentBlock = await this.api.rpc.chain.getBlock();
    let currentBlockNumber = currentBlock.block.header.number.toJSON();
    console.log(currentBlockNumber - fromBlock);
    if (fromBlock && currentBlockNumber - fromBlock < 256) {
      await this.processPastOmniverseEvent(
        fromBlock,
        currentBlockNumber,
        cbHandler
      );
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
        logger.info(
          utils.format(
            'Chain {0}, Message waiting to be finalized, nonce {1}',
            this.chainName,
            this.messageBlockHeights[0].nonce
          )
        );
      }
    }
  }

  getProvider() {
    return this.api;
  }
}

module.exports = SubstrateHandler;
