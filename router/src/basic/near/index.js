"use strict";

const path = require("path");
const homedir = require("os").homedir();
const nearAPI = require("near-api-js");
const config = require('config');
const globalDefine = require('../../utils/globalDefine');
const utils = require("../../utils/utils");
const { ErrorCode } = require("../../utils/globalDefine");

// init near protocol contract
const credentialsPath = path.join(homedir, ".near-credentials");

const TypeToNear = {
  [globalDefine.MsgType.String]: 'String',
  [globalDefine.MsgType.U8]: 'Uint8',
  [globalDefine.MsgType.U16]: 'Uint16',
  [globalDefine.MsgType.U32]: 'Uint32',
  [globalDefine.MsgType.U64]: 'Uint64',
  [globalDefine.MsgType.U128]: 'Uint128',

  [globalDefine.MsgType.I8]: 'Int8',
  [globalDefine.MsgType.I16]: 'Int16',
  [globalDefine.MsgType.I32]: 'Int32',
  [globalDefine.MsgType.I64]: 'Int64',
  [globalDefine.MsgType.StringArray]: 'VecString',
  [globalDefine.MsgType.U8Array]: 'VecUint8',
  [globalDefine.MsgType.U16Array]: 'VecUint16',
  [globalDefine.MsgType.U32Array]: 'VecUint32',
  [globalDefine.MsgType.U64Array]: 'VecUint64',
  [globalDefine.MsgType.U128Array]: 'VecUint128',
  [globalDefine.MsgType.I8Array]: 'VecInt8',
  [globalDefine.MsgType.I16Array]: 'VecInt16',
  [globalDefine.MsgType.I32Array]: 'VecInt32',
  [globalDefine.MsgType.I64Array]: 'VecInt64',
  [globalDefine.MsgType.Address]: 'Address'
};

const TypeToGlobal = {
  'String': globalDefine.MsgType.String,
  'Uint8': globalDefine.MsgType.U8,
  'Uint16': globalDefine.MsgType.U16,
  'Uint32': globalDefine.MsgType.U32,
  'Uint64': globalDefine.MsgType.U64,
  'Uint128': globalDefine.MsgType.U128,

  'Int8': globalDefine.MsgType.I8,
  'Int16': globalDefine.MsgType.I16,
  'Int32': globalDefine.MsgType.I32,
  'Int64': globalDefine.MsgType.I64,
  'VecString': globalDefine.MsgType.StringArray,
  'VecUint8': globalDefine.MsgType.U8Array,
  'VecUint16': globalDefine.MsgType.U16Array,
  'VecUint32': globalDefine.MsgType.U32Array,
  'VecUint64': globalDefine.MsgType.U64Array,
  'VecUint128': globalDefine.MsgType.U128Array,
  'VecInt8': globalDefine.MsgType.I8Array,
  'VecInt16': globalDefine.MsgType.I16Array,
  'VecInt32': globalDefine.MsgType.I32Array,
  'VecInt64': globalDefine.MsgType.I64Array,
  'Address': globalDefine.MsgType.Address,
};

class NearHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "near"));
    this.nearConfig = {
      networkId: config.get('networks.' + this.chainName + '.networkId'),
      keyStore: new nearAPI.keyStores.UnencryptedFileSystemKeyStore(
        credentialsPath
      ),
      nodeUrl: config.get('networks.' + this.chainName + '.nodeUrl'),
      contractName: config.get('networks.' + this.chainName + '.crossChainContractAddress'),
      accountId: config.get('networks.' + this.chainName + '.validatorAccountId'),
      walletUrl: config.get('networks.' + this.chainName + '.walletUrl'),
      helperUrl: config.get('networks.' + this.chainName + '.helperUrl'),
    };
    // near connect
    let near = await nearAPI.connect(this.nearConfig);
    this.account = await near.account(this.nearConfig.accountId);
  }

  async queryLatestMessageId(fromChain) {
    const latestMessageCount = await this.account.viewFunction(
      this.nearConfig.contractName,
      "get_latest_message_id",
      { from_chain: fromChain }
    );
    return latestMessageCount;
  }

  async queryPendingMessage() {
    let pendingMessage = [];
    var from_index = 0;
    var limit = 20;
    do {
      var result = await this.account.viewFunction(
        this.nearConfig.contractName,
        "get_pending_message",
        { from_index, limit }
      );
      pendingMessage.concat(result);
      from_index += limit;
    } while (result.length);

    return pendingMessage;
  }

  async getNextMessageId(fromChain) {
    return this.account.viewFunction(this.nearConfig.contractName, "get_msg_porting_task", {
      from_chain: fromChain,
      validator: config.get('networks.' + this.chainName + '.validatorPublicKey'),
    });
  }

  async getExecutableMessage() {
    let executableMessages = await this.account.viewFunction(
      this.nearConfig.contractName,
      "get_executable_message",
      { from_index: 0, limit: 20, });
    let result = [];
    for (let i in executableMessages) {
      result.push({
        chainName: executableMessages[i][0].chain,
        id: executableMessages[i][0].id
      })
    }
    return result;
  }

  // query receive message count of near protocol
  async getSentMessageCount(toChain) {
    const messageCount = await this.account.viewFunction(
      this.nearConfig.contractName,
      "get_sent_message_count",
      { to_chain: toChain }
    );
    return messageCount;
  }

  // query receive message count of near protocol
  async getSentMessageById(toChain, id) {
    let message;
    try {
      message = await this.account.viewFunction(
        this.nearConfig.contractName,
        "get_sent_message",
        { to_chain: toChain, id: String(id) }
      );
    } catch {
      return {errorCode: ErrorCode.GET_MESSAGE_ERROR}
    }
    message.id = id;
    try {
      message.content.data = this.parseData(message.content.data);
      let sqos = [];
      for (let i = 0; i < message.sqos.length; i++) {
        let item = {};
        item.t = SQoSTypeMap[message.sqos[i].t];
        item.v = message.sqos[i].v;
        sqos.push(item);
      }
      message.sqos = sqos;
      message.session = {
        id: message.session.id,
        sessionType: message.session.session_type,
        callback: message.session.callback ? message.session.callback : [],
        commitment: message.session.commitment ? message.session.commitment : [],
        answer: message.session.answer ? message.session.answer : [],
      }
    } catch {
      return {errorCode: ErrorCode.ethereum.DECODE_DATA_ERROR}
    }
    message = utils.snakeToCamel(message);
    return {errorCode: ErrorCode.SUCCESS, data: message};
  }

  // push message to Near
  async pushMessage(message) {
    let dataRet;
    try {
      dataRet = this.encodeData(message.content.data);
    } catch {
      return ErrorCode.ethereum.ENCODE_DATA_ERROR;
    }
    message.content.data = dataRet;
    message.session = utils.camelToSnake(message.session);
    message.session.session_type = Number(message.session.session_type);
    let id = String(message.id);
    delete message.id;
    message = utils.camelToSnake(message);
    let args = { id, message };
    logger.debug('Message to be pushed to chain: {0}', args);
    try {
      await this.pushTransaction("receive_message", args);
    } catch {
      return ErrorCode.ethereum.SEND_TRANSACTION_ERROR;
    }
    return ErrorCode.SUCCESS;
  }

  // 
  async executeMessage(fromChain, id) {
    const args = {
      from_chain: fromChain, // from chain name
      id: String(id), // message id
    };
    await this.pushTransaction("execute_message", args);
    logger.info(
      utils.format('Message from chain {0} executed, id is {1}', fromChain, id)
    );
  }

  // push transaction to near protocol
  async pushTransaction(methodName, args) {
    try {
      const functionCallResponse = await this.account.functionCall({
        contractId: this.nearConfig.contractName,
        methodName: methodName,
        args: args,
        gas: 70000000000000,
      });
      const result =
        await nearAPI.providers.getTransactionLastResult(functionCallResponse);
      logger.debug(utils.format('Near transaction result: {0}', result));
    } catch (error) {
      switch (JSON.stringify(error.kind)) {
        case '{"ExecutionError":"Exceeded the prepaid gas."}': {
          handleExceededThePrepaidGasError(error, options);
          break;
        }
        default: {
          logger.error(error);
        }
      }
    }
  }

  parseData(data) {
    let ret = [];
    data.forEach((item) => {
      Object.keys(item.value).map(function(key) {
        item.msgType = TypeToGlobal[key];
        if (item.msgType == globalDefine.MsgType.Address) {
          item.value = {
            address: item.value[key][0],
            chainType: item.value[key][1],
          }
        } else {
          item.value = item.value[key];
        }
        delete item.value[key];
      });
      ret.push(item);
    })
    return ret;
  }

  encodeData(data) {
    let payload = [];
    for (let i = 0; i < data.length; i++) {
      let item = {};
      item.name = data[i].name;
      item.value = {};
      let value = data[i].value;
      if (data[i].msgType == globalDefine.MsgType.Address) {
        value = [value.address, Number(value.chainType)];
      }
      if (
        data[i].msgType == globalDefine.MsgType.I8 ||
        data[i].msgType == globalDefine.MsgType.I16 ||
        data[i].msgType == globalDefine.MsgType.I32 ||
        data[i].msgType == globalDefine.MsgType.I64 ||
        data[i].msgType == globalDefine.MsgType.U8 ||
        data[i].msgType == globalDefine.MsgType.U16 ||
        data[i].msgType == globalDefine.MsgType.U32 ||
        data[i].msgType == globalDefine.MsgType.U64
      ) {
        value = Number(value);
      }
      if (
        data[i].msgType == globalDefine.MsgType.I8Array ||
        data[i].msgType == globalDefine.MsgType.I16Array ||
        data[i].msgType == globalDefine.MsgType.I32Array ||
        data[i].msgType == globalDefine.MsgType.I64Array ||
        data[i].msgType == globalDefine.MsgType.U8Array ||
        data[i].msgType == globalDefine.MsgType.U16Array ||
        data[i].msgType == globalDefine.MsgType.U32Array ||
        data[i].msgType == globalDefine.MsgType.U64Array
      ) {
        let returnValue = [];
        for (let i = 0; i < value.length; i++) {
          returnValue.push(Number(value[i]));
        }
        value = returnValue;
      }
      item.value[TypeToNear[data[i].msgType]] = value;
      payload.push(item);
    }
    return payload;
  }
}

module.exports = NearHandler;
