module.exports = {
  async sendTransaction(
    provider, moduleName, methodName, account, arguments) {
    try {
      const txHash = await provider.tx[moduleName][methodName](...arguments)
      .signAndSend(account);

      console.log('tx hash:', txHash.toJSON());
      return txHash;
    } catch (e) {
      MainLogger.error(e);
    }
  },
  
  // query info from blockchain node
  async contractCall(provider, moduleName, methodName, arguments) {
    const ret = await provider.query[moduleName][methodName](...arguments);
    return ret;
  },

  substrateTxWorker(
    { api, moduleName, methodName, account, arguments },
    callback
  ) {
    api.tx[moduleName][methodName](...arguments).signAndSend(
      account,
      ({ status, events }) => {
        // console.log(status.isInBlock, status.isFinalized);
        if (status.isInBlock || status.isFinalized) {
          let err;
          events
            // find/filter for failed events
            .filter(({ event }) => api.events.system.ExtrinsicFailed.is(event))
            // we know that data for system.ExtrinsicFailed is
            // (DispatchError, DispatchInfo)
            .forEach(
              ({
                event: {
                  data: [error, info],
                },
              }) => {
                if (error.isModule) {
                  // for module errors, we have the section indexed, lookup
                  const decoded = api.registry.findMetaError(error.asModule);
                  const { docs, method, section } = decoded;
  
                  console.log(`${section}.${method}: ${docs.join(' ')}`);
                } else {
                  // Other, CannotLookup, BadOrigin, no extra info
                  console.log(error.toString());
                }
                err = error;
              }
            );
          if (status.isInBlock) {
            callback(err);
          }
        }
      }
    );
  },
  
  async enqueueTask(
    queue,
    api,
    moduleName,
    methodName,
    account,
    arguments
  ) {
    return new Promise((resolve, reject) => {
      queue.push(
        { api, moduleName, methodName, account, arguments },
        function (error) {
          if (error) {
            reject(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }
}