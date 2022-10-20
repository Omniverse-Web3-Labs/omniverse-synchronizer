'use strict';

const {ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { Abi, ContractPromise } = require('@polkadot/api-contract');
const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
const { bool, _void, str, u8, u16, u32, u64, u128, i8, i16, i32, i64, i128, Enum, Struct, Vector, Option, Bytes } = require('scale-ts');
const utils = require('../../utils/utils');
const config = require('config');
const ink = require('./ink.js');
const fs = require('fs');
const globalDefine = require('../../utils/globalDefine');
const { util } = require('config');
const logger = require('../../utils/logger');
const ErrorCode = globalDefine.ErrorCode.ink;

const InkAddressData = Struct({
  ink_address: Option(Vector(u8, 32)),
  general_address: Option(str),
  address_type: u8,
});

const MsgDetail = Enum({
  InkString: str,
  InkU8: u8,
  InkU16: u16,
  InkU32: u32,
  InkU64: u64,
  InkU128: u128,
  InkI8: i8,
  InkI16: i16,
  InkI32: i32,
  InkI64: i64,
  InkI128: i128,
  InkStringArray: Vector(str),
  InkU8Array: Vector(u8),
  InkU16Array: Vector(u16),
  InkU32Array: Vector(u32),
  InkU64Array: Vector(u64),
  InkU128Array: Vector(u128),
  InkI8Array: Vector(i8),
  InkI16Array: Vector(i16),
  InkI32Array: Vector(i32),
  InkI64Array: Vector(i64),
  InkI128Array: Vector(i128),
  InkAddress: InkAddressData,
  // UserData: Bytes,
});

const SQoSTypeMap = {
  'Reveal': globalDefine.SQoSType.Reveal,
  'Challenge': globalDefine.SQoSType.Challenge,
  'Threshold': globalDefine.SQoSType.Threshold,
  'Priority': globalDefine.SQoSType.Priority,
  'ExceptionRollback': globalDefine.SQoSType.ExceptionRollback,
  'Anonymous': globalDefine.SQoSType.Anonymous,
  'Identity': globalDefine.SQoSType.Identity,
  'Isolation': globalDefine.SQoSType.Isolation,
  'CrossVerify': globalDefine.SQoSType.CrossVerify,
};

const SQoSTypeToInkMap = {
  [globalDefine.SQoSType.Reveal]: 'Reveal',
  [globalDefine.SQoSType.Challenge]: 'Challenge',
  [globalDefine.SQoSType.Threshold]: 'Threshold',
  [globalDefine.SQoSType.Priority]: 'Priority',
  [globalDefine.SQoSType.ExceptionRollback]: 'ExceptionRollback',
  [globalDefine.SQoSType.Anonymous]: 'Anonymous',
  [globalDefine.SQoSType.Identity]: 'Identity',
  [globalDefine.SQoSType.Isolation]: 'Isolation',
  [globalDefine.SQoSType.CrossVerify]: 'CrossVerify',
};

const MsgTypeMap = {
  InkString: globalDefine.MsgType.String,
  InkU8: globalDefine.MsgType.U8,
  InkU16: globalDefine.MsgType.U16,
  InkU32: globalDefine.MsgType.U32,
  InkU64: globalDefine.MsgType.U64,
  InkU128: globalDefine.MsgType.U128,
  InkI8: globalDefine.MsgType.I8,
  InkI16: globalDefine.MsgType.I16,
  InkI32: globalDefine.MsgType.I32,
  InkI64: globalDefine.MsgType.I64,
  InkI128: globalDefine.MsgType.I128,
  InkStringArray: globalDefine.MsgType.StringArray,
  InkU8Array: globalDefine.MsgType.U8Array,
  InkU16Array: globalDefine.MsgType.U16Array,
  InkU32Array: globalDefine.MsgType.U32Array,
  InkU64Array: globalDefine.MsgType.U64Array,
  InkU128Array: globalDefine.MsgType.U128Array,
  InkI8Array: globalDefine.MsgType.I8Array,
  InkI16Array: globalDefine.MsgType.I16Array,
  InkI32Array: globalDefine.MsgType.I32Array,
  InkI64Array: globalDefine.MsgType.I64Array,
  InkI128Array: globalDefine.MsgType.I128Array,
  InkAddress: globalDefine.MsgType.Address,
  UserData: globalDefine.MsgType.Bytes,
}

const MsgTypeToInkMap = {
  [globalDefine.MsgType.String]: 'InkString',
  [globalDefine.MsgType.U8]: 'InkU8',
  [globalDefine.MsgType.U16]: 'InkU16',
  [globalDefine.MsgType.U32]: 'InkU32',
  [globalDefine.MsgType.U64]: 'InkU64',
  [globalDefine.MsgType.U128]: 'InkU128',
  [globalDefine.MsgType.I8]: 'InkI8',
  [globalDefine.MsgType.I16]: 'InkI16',
  [globalDefine.MsgType.I32]: 'InkI32',
  [globalDefine.MsgType.I64]: 'InkI64',
  [globalDefine.MsgType.I128]: 'InkI128',
  [globalDefine.MsgType.StringArray]: 'InkStringArray',
  [globalDefine.MsgType.U8Array]: 'InkU8Array',
  [globalDefine.MsgType.U16Array]: 'InkU16Array',
  [globalDefine.MsgType.U32Array]: 'InkU32Array',
  [globalDefine.MsgType.U64Array]: 'InkU64Array',
  [globalDefine.MsgType.U128Array]: 'InkU128Array',
  [globalDefine.MsgType.I8Array]: 'InkI8Array',
  [globalDefine.MsgType.I16Array]: 'InkI16Array',
  [globalDefine.MsgType.I32Array]: 'InkI32Array',
  [globalDefine.MsgType.I64Array]: 'InkI64Array',
  [globalDefine.MsgType.I128Array]: 'InkI128Array',
  [globalDefine.MsgType.Address]: 'InkAddress',
  [globalDefine.MsgType.Bytes]: 'UserData',
}

const MessageItem = Struct({
  n: str,
  tv: MsgDetail
});

let MessagePayload = Struct({
  items: Option(Vector(MessageItem))
});

class InkHandler {
  constructor(chainName) {
    this.chainName = chainName;
  }

  async init() {
    logger.info(utils.format("Init handler: {0}, compatible chain: {1}", this.chainName, "ink"));
    // network
    this.config = config.get('networks.' + this.chainName);
    this.provider = new WsProvider(this.config.nodeAddress);
    this.api = await ApiPromise.create({provider: this.provider});

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
    const crossChainABIRaw = fs.readFileSync(this.config.abiPath);
    this.crossChainContract = new ContractPromise(this.api, JSON.parse(crossChainABIRaw), this.config.crossChainContractAddress);
  }

  // query sent message count
  async getSentMessageCount(chainName) {
    const messageCount =
      await ink.contractCall(this.crossChainContract, 'crossChainBase::getSentMessageNumber', this.sender.address, [chainName]);
    return messageCount.toString();
  }

  // get cross chain message by id
  async getSentMessageById(toChain, id) {
    let crossChainMessage;
    try {
      crossChainMessage = await ink.contractCall(
        this.crossChainContract, 'crossChainBase::getSentMessage', this.sender.address, [toChain, id]);
      crossChainMessage = crossChainMessage.asOk.toJSON();
    }
    catch (e) {
      return {errorCode: globalDefine.ErrorCode.GET_MESSAGE_ERROR};
    }
    logger.debug('Original message and data', crossChainMessage, crossChainMessage.content.data);
    
    // sqos
    let sqos = [];
    try {
      for (let i = 0; i < crossChainMessage.sqos.length; i++) {
        let item = {};
        item.t = SQoSTypeMap[crossChainMessage.sqos[i].t];
        item.v = utils.toByteArray(crossChainMessage.sqos[i].v);
        sqos.push(item);
      }
    }
    catch (e) {
      return {errorCode: ErrorCode.DECODE_SQOS_ERROR};
    }

    // data
    let dataRet = await this.decodeData(crossChainMessage.content.data);
    if (dataRet.errorCode != globalDefine.ErrorCode.SUCCESS) {
      return dataRet;
    }

    let message;
    try {
      message = {
        id: crossChainMessage.id.toString(),
        fromChain: crossChainMessage.fromChain,
        toChain: crossChainMessage.toChain,
        sender: utils.toByteArray(crossChainMessage.sender),
        signer: utils.toByteArray(crossChainMessage.signer),
        session: {
            id: crossChainMessage.session.id.toString(),
            sessionType: crossChainMessage.session.sessionType.toString(),
            callback: utils.toByteArray(crossChainMessage.session.callback),
            commitment: utils.toByteArray(crossChainMessage.session.commitment),
            answer: utils.toByteArray(crossChainMessage.session.answer),
        },
        sqos: sqos,
        content: {
            contract: utils.toByteArray(crossChainMessage.content.contract),
            action: utils.toByteArray(crossChainMessage.content.action),
            data: dataRet.data,
        }
      };
    }
    catch (e) {
      return {errorCode: ErrorCode.TO_CORE_MESSAGE_ERROR};
    }

    try {
      utils.checkMessageFormat(message);
    }
    catch (e) {
      logger.error(e);
      return {errorCode: ErrorCode.MESSAGE_FORMAT_ERROR};
    }
    logger.debug('Dealed message', message);
    return {errorCode: globalDefine.ErrorCode.SUCCESS, data: message};
  }

  // get id of message to be ported
  async getNextMessageId(chainName) {
    const crossChainMessage = await ink.contractCall(
      this.crossChainContract, 'getMsgPortingTask', this.sender.address, [chainName, this.sender.address]);
    return crossChainMessage.toString();
  }

  // query executable 
  async getExecutableMessage(chainNames) {
    let _messages = await ink.contractCall(
      this.crossChainContract, 'crossChainBase::getExecutableMessages', this.sender.address, [chainNames]);
    _messages = _messages.toJSON().map((m) => {return {chainName: m[0], id: m[1]}});
    return _messages;
  }

  // push message to cross chain contract
  async pushMessage(message) {
    logger.debug('pushMessage input data', message);
    // deal data
    let dataRet = await this.encodeData(message.content.data);
    if (dataRet.errorCode != globalDefine.ErrorCode.SUCCESS) {
      return dataRet.errorCode;
    }
    message.content.data = dataRet.data;

    // deal sqos
    let sqos = [];
    try {
      for (let i = 0; i < message.sqos.length; i++) {
        let item = {};
        item.t = SQoSTypeToInkMap[message.sqos[i].t];
        item.v = utils.toHexString(message.sqos[i].v);
        sqos.push(item);
      }
    }
    catch (e) {
      return ErrorCode.ENCODE_SQOS_ERROR;
    }

    let m;
    try {
      m = {
        id: message.id,
        fromChain: message.fromChain,
        toChain: this.chainName,
        sender: utils.toHexString(message.sender),
        signer: utils.toHexString(message.signer),
        contract: utils.toHexString(message.content.contract),
        action: utils.toHexString(message.content.action),
        data: message.content.data,
        sqos: sqos,
        session: {
          id: message.session.id,
          sessionType: message.session.sessionType,
          callback: utils.toHexString(message.session.callback),
          commitment: utils.toHexString(message.session.commitment),
          answer: utils.toHexString(message.session.answer)
        }
      };
    }
    catch (e) {
      return ErrorCode.TO_INK_MESSAGE_ERROR;
    }

    // send transaction
    logger.debug('Message to be pushed to chain', m);
    let ret = await ink.sendTransaction(
      this.crossChainContract, 'crossChainBase::receiveMessage', this.sender, [m]);

    if (ret != null) {
      logger.info('Push message successfully, message: ' + m);
      return globalDefine.ErrorCode.SUCCESS;
    }

    return ErrorCode.SEND_TRANSACTION_ERROR;
  }

  // encode the data
  async encodeData(data) {
    logger.debug('encodeData: ', data);
    let payload = {
      items:[]
    };

    let encoded;

    try {
      for (let i = 0; i < data.length; i++) {
        let item = {};
        item.n = data[i].name;
        item.tv = {tag: MsgTypeToInkMap[data[i].msgType]};
        let value;
        if (data[i].msgType == globalDefine.MsgType.I128 || data[i].msgType == globalDefine.MsgType.I64 ||
          data[i].msgType == globalDefine.MsgType.U128 || data[i].msgType == globalDefine.MsgType.U64) {
            value = BigInt(data[i].value);
        }
        else if (data[i].msgType == globalDefine.MsgType.I128Array || data[i].msgType == globalDefine.MsgType.I64Array ||
          data[i].msgType == globalDefine.MsgType.U128Array || data[i].msgType == globalDefine.MsgType.U64Array) {
            value = [];
            for (let j in value) {
              value[j] = BigInt(data[i].value[j]);
            }
        }
        else {
          value = data[i].value;
        }

        item.tv.value = value;
        logger.debug('messagePayload item: ', item);
        payload.items.push(item);
      }
      encoded = utils.toHexString(MessagePayload.enc(payload));
    }
    catch (e) {
      logger.error(e)
      return {errorCode: ErrorCode.ENCODE_DATA_ERROR};
    }

    logger.debug('encodeData result: ', encoded);

    return {errorCode: globalDefine.ErrorCode.SUCCESS, data: encoded};
  }

  // parse data
  async decodeData(data) {
    logger.debug('decodeData', data);
  
    let ret = [];
    try {
      let payload = MessagePayload.dec(data);
      for (let i = 0; i < payload.items.length; i++) {
        logger.debug('decodeData: decoded data', i, payload.items[i], payload.items[i].tv.value);
      }
      if (payload.items) {
        for (let i = 0; i < payload.items.length; i++){
          let item = {};
          item.name = payload.items[i].n;
          item.msgType = MsgTypeMap[payload.items[i].tv.tag];
          let value = payload.items[i].tv.value;
          if (typeof(value) != 'object') {
            value = payload.items[i].tv.value.toString();
          }
          item.value = value;
          
          ret.push(item);
        }
      }
    }
    catch (e) {
      logger.error(e);
      logger.info('Decode data error, payload is: ', payload);
      return {errorCode: ErrorCode.DECODE_DATA_ERROR};
    }

    logger.debug('decodeData: result', ret);
    return {errorCode: globalDefine.ErrorCode.SUCCESS, data: ret};
  }

  // execute message
  async executeMessage(chainName, id) {
    // send transaction
    let ret = await ink.sendTransaction(
      this.crossChainContract, 'crossChainBase::executeMessage', this.sender, [chainName, id]);

    if (ret != null) {
      logger.info(
        this.chainName + ' messageId ' + id + ' executed, fromChain ' + chainName);
    }
  }

  // abandon message
  async abandonMessage(chainName, id, errorCode) {
    // send transaction
    let ret = await ink.sendTransaction(
      this.crossChainContract, 'crossChainBase::abandonMessage', this.sender, [chainName, id, errorCode]);

    if (ret != null) {
      logger.info(utils.format('Abandon message id: {0} successfully, errorCode is: {1}', id, errorCode));
    }
  }

  getProvider() {
    return this.provider;
  }
}

module.exports = InkHandler;