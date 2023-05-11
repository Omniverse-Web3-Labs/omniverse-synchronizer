module.exports = {
  async sendTransaction(
    provider, moduleName, methodName, account, arguments) {
    try {
      const txHash = await provider.tx[moduleName][methodName](...arguments)
      .signAndSend(account);

      console.log('tx hash:', txHash.toJSON());
      return txHash;
    } catch (e) {
      console.error(e);
    }
  },
  
  // query info from blockchain node
  async contractCall(provider, moduleName, methodName, arguments) {
    const ret = await provider.query[moduleName][methodName](...arguments);
    return ret;
  }
}