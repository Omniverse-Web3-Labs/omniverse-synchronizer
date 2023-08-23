const {ODLT, inscription} = require('../../../../omniverse-btc-lib/dist/index');

inscription.setNetwork(inscription.Network.Regtest);

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