const {ODLT} = require('@hthuang/bitcoin-lib/dist/index');

module.exports = {
    /**
     * 
     * @param data: {
     *  nonce:
     *  initiateSC:
     *  from:
     *  chainId:
     *  payload: {key: value}   // except for bytes/U8Array
     *  signature:
     * }
     */
    async sendOmniverseTransaction(data) {
        ODLT.sendOmniverseTransaction({
            nonce: BigInt(data.nonce),
            initiateSC: data.initiateSC,
            from: data.from,
            chainId: data.chainId,
            payload: JSON.stringify(data.payload),
            signature: data.signature,
        });
    }
}