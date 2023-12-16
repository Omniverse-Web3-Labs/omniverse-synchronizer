'use strict';

const globalDefine = require("./globalDefine");
const assert = require('assert');

async function sleep(seconds) {
    await new Promise((resolve) => {
        setTimeout(() => {
        resolve();
        }, seconds * 1000);
    });
}

function format() {
    if (arguments.length == 0)
        return null;

    let str = arguments[0]; 
    for (let i = 1; i < arguments.length; i++) {
        let re = new RegExp('\\{' + (i - 1) + '\\}', 'gm');
        str = str.replace(re, arguments[i]);
    }
    return str;
}

// Convert normal string to u8 array
function stringToByteArray(str) {
    return Array.from(str, function(byte) {
        return byte.charCodeAt(0);
    });
}

// Convert u8 array to hex string
function toHexString(byteArray) {
    return '0x' + Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
}

// Convert hex string to u8 array buffer
function toByteArray(hexString) {
    if (hexString.substr(0, 2) == '0x') {
        hexString = hexString.substr(2);
    }
    
    let result = [];
    for (let i = 0; i < hexString.length; i += 2) {
        result.push(parseInt(hexString.substr(i, 2), 16));
    }
    return result;
}

// Checkout if the format of a message is correct
function checkMessageFormat(message) {
    MainLogger.debug('checkMessageFormat', message, message.content.data);
    assert(typeof(message.id) == 'string');
    assert(typeof(message.fromChain) == 'string');
    assert(typeof(message.toChain) == 'string');
    assert(typeof(message.sender) == 'object');
    assert(typeof(message.signer) == 'object');
    assert(typeof(message.content.contract) == 'object');
    assert(typeof(message.content.action) == 'object');
    assert(typeof(message.session.id) == 'string');
    assert((message.session.callback == null || typeof(message.session.callback) == 'object'));
    for (let i = 0; i < message.sqos.length; i++) {
        let item = message.sqos[i];
        assert(item.t >= 0 && item.t < globalDefine.SQoSType.MAX);
        assert(item.v == null || typeof(item.v) == 'object');
    }
    for (let i = 0; i < message.content.data.length; i++) {
        let item = message.content.data[i];
        assert(item.msgType >= 0 && item.msgType < globalDefine.MsgType.MAX);
        assert(typeof(item.name) == 'string');
        assert(item.value == null || typeof(item.value) == 'string' || typeof(item.value) == 'object');
    }
}

// Camel-Case to Snake-case
function camelToSnake(object) {
    let newObject = {};
    Object.keys(object).reduce((_, key) => {
        let newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        newObject[newKey] = object[key]
    }, {});
    return newObject;
}

// Snake-case to Camel-Case
function snakeToCamel(object) {
    let newObject = {};
    Object.keys(object).reduce((_, key) => {
        let newKey = key.replace(/\_(\w)/g, function(_, letter){
        return letter.toUpperCase();
        });
        newObject[newKey] = object[key];
    }, {});
    return newObject;
}

module.exports = {
    sleep: sleep,
    toHexString: toHexString,
    toByteArray: toByteArray,
    format: format,
    stringToByteArray: stringToByteArray,
    checkMessageFormat: checkMessageFormat,
    camelToSnake,
    snakeToCamel,
}