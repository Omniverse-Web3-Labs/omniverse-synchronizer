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
    logger.info(
      utils.format(
        'Init handler: {0}, compatible chain: {1}',
        this.chainName,
        'ethereum'
      )
    );
    this.restoreBlockHeight = 0;
    // Enable auto reconnection
    const options = {
      reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 10,
        onTimeout: false,
      },
    };
    this.messageBlockHeights = [];
    let provider = new Web3.providers.WebsocketProvider(
      config.get('networks.' + this.chainName + '.nodeAddress'),
      options
    );
    this.web3 = new Web3(provider);
    this.web3.eth.handleRevert = true;
    let secret = JSON.parse(fs.readFileSync(config.get('secret')));
    this.testAccountPrivateKey = secret[this.chainName];
    // omniverseContract
    let omniverseContractAddress = config.get(
      'networks.' + this.chainName + '.omniverseContractAddress'
    );
    let omniverseContractRawData = fs.readFileSync(
      config.get('networks.' + this.chainName + '.omniverseContractAbiPath')
    );
    let omniverseContractAbi = JSON.parse(omniverseContractRawData).abi;
    this.omniverseContract = {};
    for (let tokenId in omniverseContractAddress) {
      let contract = new this.web3.eth.Contract(
        omniverseContractAbi,
        omniverseContractAddress[tokenId]
      );
      this.omniverseContract[tokenId] = contract;
    }

    this.chainId = config.get('networks.' + this.chainName + '.chainId');
    this.omniverseChainId = config.get(
      'networks.' + this.chainName + '.omniverseChainId'
    );
    this.payloadCfg = config.get('payload');
    this.messages = [];

    for (let i = 0; i < omniverseContractAbi.length; i++) {
      if (
        omniverseContractAbi[i].type == 'event' &&
        omniverseContractAbi[i].name == OMNIVERSE_TOKEN_TRANSFER
      ) {
        this.eventOmniverseTokenTransfer = omniverseContractAbi[i];
        this.eventOmniverseTokenTransfer.signature =
          this.web3.eth.abi.encodeEventSignature(
            this.eventOmniverseTokenTransfer
          );
      }
    }
  }

  async addMessageToList(message, tokenId) {
    let params = [];
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      if (this.payloadCfg.keys[i] == 'bytes') {
        params.push(
          utils.toHexString(message.payload[this.payloadCfg.keys[i]])
        );
      } else {
        params.push(message.payload[this.payloadCfg.keys[i]]);
      }
    }
    let opData = this.web3.eth.abi.encodeParameters(
      this.payloadCfg.types,
      params
    );

    this.messages.push({
      nonce: message.nonce,
      initiateSC: message.initiateSC,
      from: message.from,
      chainId: message.chainId,
      payload: opData,
      signature: message.signature,
      tokenId,
    });
  }

  async pushMessages(cbHandler) {
    for (let i = 0; i < this.messages.length; i++) {
      let message = this.messages[i];
      let tokenId = message.tokenId;
      let contract = this.omniverseContract[tokenId];
      let nonce = await ethereum.contractCall(contract, 'getTransactionCount', [
        message.from,
      ]);
      if (nonce >= message.nonce) {
        let txData = await ethereum.contractCall(contract, 'transactionCache', [
          message.from,
        ]);
        if (txData.timestamp == 0) {
          // message exists
          if (nonce > message.nonce) {
            let hisData = await ethereum.contractCall(
              contract,
              'getTransactionData',
              [message.from, message.nonce]
            );
            let bCompare =
              hisData[0].nonce == message.nonce &&
              hisData[0].chainId == message.chainId &&
              hisData[0].initiateSC == message.initiateSC &&
              hisData[0].from == message.from &&
              hisData[0].payload == message.payload &&
              hisData[0].signature == message.signature;
            if (bCompare) {
              this.messages.splice(i, 1);
              logger.debug(
                utils.format(
                  'The message of pk {0}, nonce {1}, tokenId {3} has been executed on chain {2}',
                  message.from,
                  message.nonce,
                  this.chainName,
                  tokenId
                )
              );
              cbHandler.onMessageExecuted(
                this.omniverseChainId,
                message.from,
                message.nonce,
                tokenId
              );
              return;
            }
          }

          delete message.tokenId;
          let ret = await ethereum.sendTransaction(
            this.web3,
            this.chainId,
            contract,
            'sendOmniverseTransaction',
            this.testAccountPrivateKey,
            [message]
          );
          if (ret) {
            this.messages.splice(i, 1);
            logger.debug(
              utils.format(
                'The message of pk {0}, nonce {1} has been pushed to chain {2}',
                message.from,
                message.nonce,
                this.chainName
              )
            );
            break;
          }
        } else {
          logger.info(utils.format('Chain: {0} Cooling down', this.chainName));
        }
      } else {
        logger.info('Caching');
      }
    }
  }

  async update() {
    let blockNumber = await this.web3.eth.getBlockNumber();
    if (this.messageBlockHeights.length == 0) {
      stateDB.setValue(this.chainName, blockNumber);
    } else {
      if (this.messageBlockHeights[0].height > blockNumber) {
        stateDB.setValue(self.chainName, blockNumber);
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

  async beforeRestore() {
    this.restoreBlockHeight = await this.web3.eth.getBlockNumber();
  }

  async restore(pendings, cbHandler) {
    for (let i = 0; i < pendings.length; i++) {
      let checkItem = (item) => {
        return item[0] == this.chainName;
      };

      let item = pendings[i].chains.find(checkItem);
      let tokenId = pendings[i].tokenId;
      let contract;
      if (Object.keys(this.omniverseContract).includes(tokenId)) {
        contract = this.omniverseContract[tokenId];
      } else {
        logger.error(
          utils.format('The contract of {0} yet been initialized.', tokenId)
        );
        return;
      }
      if (item) {
        logger.debug(
          utils.format(
            'Transaction has been pushed to chain {0}',
            this.chainName
          )
        );
        let message;
        let nonce = await ethereum.contractCall(
          contract,
          'getTransactionCount',
          [pendings[i].pk]
        );
        logger.debug('nonce', nonce);
        if (nonce > pendings[i].nonce) {
          message = await ethereum.contractCall(
            contract,
            'getTransactionData',
            [pendings[i].pk, pendings[i].nonce]
          );
        } else {
          message = await ethereum.contractCall(contract, 'transactionCache', [
            pendings[i].pk,
          ]);
          logger.debug('cached message', message);
          if (message.txData.nonce != pendings[i].nonce) {
            logger.error(
              utils.format(
                'Chain {0} Restore work failed, pk {1}, nonce {2}, tokenId {3}',
                this.chainName,
                pendings[i].pk,
                pendings[i].nonce,
                tokenId
              )
            );
            throw 'Restore failed';
          }
        }
        logger.debug('Message is', message);
        let members = await ethereum.contractCall(contract, 'getMembers', []);
        let data = this.generalizeData(message.txData.payload);
        let m = {
          nonce: message.txData.nonce,
          chainId: message.txData.chainId,
          initiateSC: message.txData.initiateSC,
          from: message.txData.from,
          payload: data,
          signature: message.txData.signature,
        };
        if (
          cbHandler.onMessageSent(this.omniverseChainId, m, members, tokenId)
        ) {
          this.messageBlockHeights.push({
            from: pendings[i].pk,
            nonce: pendings[i].nonce,
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
    for (let tokenId in this.omniverseContract) {
      let contract = this.omniverseContract[tokenId];
      let ret = await ethereum.contractCall(
        contract,
        'getExecutableDelayedTx',
        []
      );
      if (ret.sender != '0x') {
        logger.debug(
          utils.format(
            'Chain {0}, Delayed transaction {1}',
            this.chainName,
            ret
          )
        );
        let receipt = await ethereum.sendTransaction(
          this.web3,
          this.chainId,
          contract,
          'triggerExecution',
          this.testAccountPrivateKey,
          []
        );
        if (!receipt) {
          logger.debug('receipt', receipt);
        } else {
          logger.debug(receipt.logs[0].topics, receipt.logs[0].data);
          for (let i = 0; i < receipt.logs.length; i++) {
            let log = receipt.logs[i];
            if (log.address == contract._address) {
              if (log.topics[0] == this.eventOmniverseTokenTransfer.signature) {
                let decodedLog = this.web3.eth.abi.decodeLog(
                  this.eventOmniverseTokenTransfer.inputs,
                  log.data,
                  log.topics.slice(1)
                );
                logger.info(
                  utils.format(
                    'Execute OmniverseTransfer successfully: {0} transfer {1} to {2}.',
                    decodedLog.from,
                    decodedLog.value,
                    decodedLog.to
                  )
                );
              }
            }
          }
        }
      }
    }
  }

  generalizeData(payload) {
    let ret = {};
    let opData = this.web3.eth.abi.decodeParameters(
      this.payloadCfg.types,
      payload
    );
    for (let i = 0; i < this.payloadCfg.keys.length; i++) {
      if (this.payloadCfg.types[i] == 'bytes') {
        ret[this.payloadCfg.keys[i]] = utils.toByteArray(opData[i]);
      } else {
        ret[this.payloadCfg.keys[i]] = opData[i];
      }
    }

    return ret;
  }

  async messageFinalized(from, nonce, tokenId) {
    let height;
    for (let i = 0; i < this.messageBlockHeights.length; i++) {
      if (
        this.messageBlockHeights[i].from == from &&
        this.messageBlockHeights[i].nonce == nonce &&
        this.messageBlockHeights[i].tokenId == tokenId
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

  async start(cbHandler) {
    let fromBlock = this.restoreBlockHeight || stateDB.getValue(this.chainName);
    let blockNumber = await this.web3.eth.getBlockNumber();
    if (!fromBlock) {
      fromBlock = 'latest';
    } else {
      if (blockNumber - fromBlock > globalDefine.LogRange) {
        logger.info(
          utils.format(
            'Chain {0}: Exceed max log range, subscribe from the latest',
            this.chainName
          )
        );
        fromBlock = 'latest';
      }
    }
    logger.info(
      utils.format('Chain {0}: Block height {1}', this.chainName, fromBlock)
    );
    for (let tokenId in this.omniverseContract) {
      let contract = this.omniverseContract[tokenId];
      contract.events
        .TransactionSent({
          fromBlock: fromBlock,
        })
        .on('connected', (subscriptionId) => {
          logger.info('TransactionSent connected', subscriptionId);
        })
        .on('data', async (event) => {
          logger.debug('TransactionSent event', event);
          // to be continued, decoding is needed here for omniverse
          console.log(event.returnValues.pk, event.returnValues.nonce);
          let message = await ethereum.contractCall(
            contract,
            'transactionCache',
            [event.returnValues.pk]
          );
          if (
            message.timestamp != 0 &&
            event.returnValues.nonce == message.txData.nonce
          ) {
            console.log(
              utils.format(
                'Chain: {0}, gets cached transaction',
                this.chainName
              )
            );
          } else {
            let messageCount = await ethereum.contractCall(
              contract,
              'getTransactionCount',
              [event.returnValues.pk]
            );
            if (messageCount > event.returnValues.nonce) {
              message = await ethereum.contractCall(
                contract,
                'getTransactionData',
                [event.returnValues.pk, event.returnValues.nonce]
              );
            } else {
              console.log('No transaction got', this.chainName);
              return;
            }
          }
          let members = await ethereum.contractCall(contract, 'getMembers', []);
          let data = this.generalizeData(message.txData.payload);
          let m = {
            nonce: message.txData.nonce,
            chainId: message.txData.chainId,
            initiateSC: message.txData.initiateSC,
            from: message.txData.from,
            payload: data,
            signature: message.txData.signature,
          };
          if (
            cbHandler.onMessageSent(this.omniverseChainId, m, members, tokenId)
          ) {
            this.messageBlockHeights.push({
              from: event.returnValues.pk,
              nonce: event.returnValues.nonce,
              height: event.blockNumber,
              tokenId,
            });
          }
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

      contract.events
        .TransactionExecuted()
        .on('connected', (subscriptionId) => {
          logger.info('TransactionExecuted connected', subscriptionId);
        })
        .on('data', async (event) => {
          logger.debug('TransactionExecuted event', event);
          // to be continued, decoding is needed here for omniverse
          cbHandler.onMessageExecuted(
            this.omniverseChainId,
            event.returnValues.pk,
            event.returnValues.nonce,
            tokenId
          );
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

      contract.events
        .TransactionDuplicated()
        .on('connected', (subscriptionId) => {
          logger.info('TransactionDuplicated connected', subscriptionId);
        })
        .on('data', async (event) => {
          logger.debug('TransactionDuplicated event', event);
          // to be continued, decoding is needed here for omniverse
          cbHandler.onMessageExecuted(
            this.omniverseChainId,
            event.returnValues.pk,
            event.returnValues.nonce,
            tokenId
          );
        })
        .on('changed', (event) => {
          // remove event from local database
          logger.info('TransactionDuplicated changed');
          logger.debug(event);
        })
        .on('error', (error, receipt) => {
          // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
          logger.info('TransactionDuplicated error', this.chainName, error);
          logger.info('TransactionDuplicated receipt', receipt);
        });
    }
  }

  getProvider() {
    return this.web3;
  }
}

module.exports = EthereumHandler;
