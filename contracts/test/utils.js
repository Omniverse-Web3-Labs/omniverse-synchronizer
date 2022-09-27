const utils = require('./utils');

const expectThrow = async (promise, message) => {
    try {
        await promise;
    }
    catch (err) {
        if (!message) {
            const outOfGas = err.message.includes("out of gas");
            const invalidOpcode = err.message.includes("invalid opcode");
            assert(
                outOfGas || invalidOpcode,
                "Expected throw, got `" + err + "` instead"
            );
        }
        else {
            const expectedException = err.message.includes(message);
            assert(expectedException,
                "Expected throw, got `" + err + "` instead")
        }
        return;
    }
    assert.fail("Expected throw not received");
};

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

module.exports = {
    stringToByteArray: stringToByteArray,
    toHexString: toHexString,
    expectThrow: expectThrow
}