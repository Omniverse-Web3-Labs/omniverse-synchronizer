'use strict';

const {ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { Abi, ContractPromise } = require('@polkadot/api-contract');
const { bool, _void, str, u8, u16, u32, u64, u128, i8, i16, i32, i64, i128, Enum, Struct, Vector, Option, Bytes } = require('scale-ts');
const utils = require('../../utils/utils');
const config = require('config');
const ink = require('./ink.js');
const fs = require('fs');
const logger = require('../../utils/logger');

let TypeMap = {
  'uint8': u8,
  'uint16': u16,
  'uint32': u32,
  'uint64': u64,
  'uint128': u128,
  'uint256': u128,
  'int8': i8,
  'int16': i16,
  'int32': i32,
  'int64': i64,
  'int128': i128,
  'int256': i128,
  'bytes': Vector(u8)
}

class InkHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "ink"));
    // network
    this.provider = new WsProvider(config.get('networks.' + this.chainName + '.nodeAddress'));
    this.api = await ApiPromise.create({provider: this.provider});
    this.omniverseChainId = config.get('networks.' + this.chainName + '.omniverseChainId');
    this.messageBlockHeights = [];

    this.payloadCfg = config.get('payload');
    this.messages = [];

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
    logger.info('Porter address is: ' + this.sender.address);

    // contract
    const omniverseABIRaw = fs.readFileSync(config.get('networks.' + this.chainName + '.abiPath'));
    this.omniverseContract = new ContractPromise(this.api, JSON.parse(omniverseABIRaw), config.get('networks.' + this.chainName + '.omniverseContractAddress'));
  }

  async addMessageToList(message) {
    logger.debug('addMessageToList')
    let scaleStruct = {};
    let convertedPayload = {};
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      scaleStruct[this.payloadCfg.keys[i]] = TypeMap[this.payloadCfg.types[i]];
      if (this.payloadCfg.types[i].includes('bytes')) {
        convertedPayload[this.payloadCfg.keys[i]] = message.payload[this.payloadCfg.keys[i]];
      }
      else if (this.payloadCfg.types[i].includes('int64') || this.payloadCfg.types[i].includes('int128') || this.payloadCfg.types[i].includes('int256')) {
        convertedPayload[this.payloadCfg.keys[i]] = BigInt(message.payload[this.payloadCfg.keys[i]]);
      }
      else {
        convertedPayload[this.payloadCfg.keys[i]] = parseInt(message.payload[this.payloadCfg.keys[i]]);
      }
    }
    let scalePayload = Struct(scaleStruct);
    console.log('convertedPayload', convertedPayload)
    let payload = utils.toHexString(scalePayload.enc(convertedPayload));

    this.messages.push({
      nonce: message.nonce,
      initiateSc: message.initiateSC,
      from: message.from,
      chainId: message.chainId,
      payload: payload,
      signature: message.signature,
    });
  }

  async pushMessages(cbHandler) {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      let nonce = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionCount', this.sender.address, [message.from]);
      if (nonce >= message.nonce) {
        let txData = await ink.contractCall(this.omniverseContract, 'omniverse::getCachedTransaction', this.sender.address, [message.from]);
        if (txData.isNone) {
          // message exists
          if (nonce > message.nonce) {
            let hisData = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionData', this.sender.address, [message.from, message.nonce]).unwrap();
            let bCompare = (hisData.txData.nonce == message.nonce) && (hisData.txData.chainId == message.chainId) && (hisData.txData.initiateSc == message.initiateSc) &&
            (hisData.txData.from == message.from) && (hisData.txData.payload == message.payload) && (hisData.txData.signature == message.signature);
            if (bCompare) {
              this.messages.splice(i, 1);
              logger.debug(utils.format('The message of pk {0}, nonce {1} has been executed on chain {2}', message.from, message.nonce, this.chainName));
              cbHandler.onMessageExecuted(this.omniverseChainId, message.from, message.nonce);
              return;
            }
          }

          let ret = await ink.sendTransaction(
            this.omniverseContract, 'fungibleToken::sendOmniverseTransaction', this.sender, [message]);
          if (ret) {
            this.messages.splice(i, 1);
            logger.debug(utils.format('The message of pk {0}, nonce {1} has been pushed to chain {2}', message.from, message.nonce, this.chainName));
            break;
          }
        }
        else {
          logger.info(utils.format('Chain: {0} Cooling down', this.chainName));
        }
      }
      else {
        logger.info('Caching');
      }
    }
  }

  async update() {
    let signedBlock = await this.api.rpc.chain.getBlock();
    let signedBlockNumber = signedBlock.block.header.number.toJSON();
    if (this.messageBlockHeights.length == 0) {
      stateDB.setValue(this.chainName, signedBlockNumber);
    }
    else {
      if (this.messageBlockHeights[0].height > signedBlockNumber) {
        stateDB.setValue(self.chainName, signedBlockNumber);
      }
      else {
        logger.info(utils.format('Chain {0}, Message waiting to be finalized, nonce {1}', this.chainName, this.messageBlockHeights[0].nonce));
      }
    }
  }

  async beforeRestore() {
    let signedBlock = await this.api.rpc.chain.getBlock();
    this.restoreBlockHeight = signedBlock.block.header.number.toJSON();;
  }

  async restore(pendings, cbHandler) {
    for (let i = 0; i < pendings.length; i++) {
      let checkItem = (item) => {
        return item[0] == this.chainName;
      }

      let item = pendings[i].chains.find(checkItem);
      if (item) {
        logger.debug(utils.format('Transaction has been pushed to chain {0}', this.chainName));
        let message;
        let nonce = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionCount', this.sender.address, [message.from]);
        logger.debug('nonce', nonce);
        if (nonce > pendings[i].nonce) {
          message = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionData', this.sender.address, [message.from, message.nonce]).unwrap();
        }
        else {
          message = await ink.contractCall(this.omniverseContract, 'omniverse::getCachedTransaction', this.sender.address, [message.from]);
          logger.debug('cached message', message);
          if (message.txData.nonce != pendings[i].nonce) {
            logger.error(utils.format('Chain {0} Restore work failed, pk {1}, nonce {2}', this.chainName, pendings[i].pk, pendings[i].nonce));
            throw 'Restore failed';
          }
        } 
        logger.debug('Message is', message);
        let members = await ink.contractCall(this.omniverseContract, 'fungibleToken::getMembers', this.sender.address, []);
        let data = this.generalizeData(message.txData.payload);
        let m = {
          nonce: message.txData.nonce,
          chainId: message.txData.chainId,
          initiateSC: message.txData.initiateSc,
          from: message.txData.from,
          payload: data,
          signature: message.txData.signature,
        }
        if (cbHandler.onMessageSent(this.omniverseChainId, m, members)) {
          this.messageBlockHeights.push({
            from: pendings[i].pk,
            nonce: pendings[i].nonce,
            height: item[1]
          });
        }
      }
      else {
        logger.debug(utils.format('Transaction has not been pushed to chain {0}', this.chainName));
      }
    }
  }

  async tryTrigger() {
    let delayed = await ink.contractCall(this.omniverseContract, 'fungibleToken::getExecutableDelayedTransaction', this.sender.address, []);
    delayed = delayed.toHuman();
    if (delayed) {
      logger.debug(utils.format('Chain {0}, Delayed transaction {1}', this.chainName, delayed.toString()));
      let ret = await ink.sendTransaction(
        this.omniverseContract, 'fungibleToken::triggerExecution', this.sender, []);
      if (!ret) {
        // Error
      }
      else {
        // Succeed
        // logger.debug(receipt.logs[0].topics, receipt.logs[0].data);
        // for (let i = 0; i < receipt.logs.length; i++) {
        //   let log = receipt.logs[i];
        //   if (log.address == this.omniverseContractContract._address) {
        //     if (log.topics[0] == this.eventOmniverseTokenTransfer.signature) {
        //       let decodedLog = this.web3.eth.abi.decodeLog(this.eventOmniverseTokenTransfer.inputs, log.data, log.topics.slice(1));
        //       logger.info(utils.format('Execute OmniverseTransfer successfully: {0} transfer {1} to {2}.',
        //         decodedLog.from, decodedLog.value, decodedLog.to));
        //     }
        //   }
        // }
      }
    }
  }

  generalizeData(payload) {
    let scaleStruct = {};
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      scaleStruct[this.payloadCfg.keys[i]] = TypeMap[this.payloadCfg.types[i]];
    }
    let scalePayload = Struct(scaleStruct);
    let data = scalePayload.dec(payload);
    logger.debug('data::', data);

    return data;
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
      // logger.error('The block height should not be null');
      return;
    }

    global.stateDB.setValue(this.chainName, height + 1);
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

  async processPastOmniverseEvent(startBlock, currentBlockNumber, cbHandler) {
    for (; startBlock < currentBlockNumber; ++startBlock) {
      let hash = await this.api.rpc.chain.getBlockHash(startBlock);
      await this.getOmniverseEvent(hash, cbHandler);
    }
    this.messageBlockHeights = [];
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
        // logger.debug('ink event', event);
        // Show what we are busy with
        if (event.section == 'contracts') {
          if (event.method == 'ContractEmitted') {
            let data = event.data.toJSON();
            console.log('data', data);
            if (data[0] == config.get('networks.' + this.chainName + '.omniverseContractAddress')) {
              console.log(Buffer.from(data[1].slice(2), 'hex'));
              let decodedEvent = this.omniverseContract.abi.decodeEvent(new Uint8Array(Buffer.from(data[1].slice(2), 'hex')));
              console.log('decodedEvent', decodedEvent);
              let pk = decodedEvent.args[0].toHuman();
              let nonce = decodedEvent.args[1].toHuman();
              let message = await ink.contractCall(
                this.omniverseContract,
                'omniverse::getCachedTransaction',
                this.sender.address,
                [pk]
                );

              if (message.isSome && message.toJSON().txData.nonce == nonce) {
                message = message.toJSON();
                console.log(utils.format('Chain: {0}, gets cached transaction', this.chainName));
              }
              else {
                let messageCount = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionCount', this.sender.address, [pk]);
                if (messageCount > nonce) {
                  message = await ink.contractCall(this.omniverseContract, 'omniverse::getTransactionData', this.sender.address, [pk, nonce]);
                  message = message.toJSON();
                }
                else {
                  console.log('No transaction got', this.chainName);
                  return;
                }
              }
              let mb = await ink.contractCall(this.omniverseContract, 'fungibleToken::getMembers', this.sender.address, []);
              let m = message.txData;
              let payload = this.generalizeData(m.payload);
              m.payload = payload;
              m.initiateSC = m.initiateSc;
              delete m.initiateSc;
              let members = [];
              for (let member of mb) {
                members.push({
                  chainId: member.chainId,
                  contractAddr: member.contractAddress,
                });
              }
              if (cbHandler.onMessageSent(this.omniverseChainId, m, members)) {
                this.messageBlockHeights.push({
                  from: m.from,
                  nonce: m.nonce,
                  height: blockNumber,
                });
              }
            }
          }
        }
      });
    });
  }
}

module.exports = InkHandler;