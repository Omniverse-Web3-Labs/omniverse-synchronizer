const chainHandlerMgr = require('./basic/chainHandlerMgr');
global.config = require('config');
global.logger = require('./utils/logger');
global.utils = require('./utils/utils');
global.globalDefine = require('./utils/globalDefine');

async function init() {
  await chainHandlerMgr.init();
}

async function main() {
  logger.info("Launch validator node...");
  await init();
  chainHandlerMgr.run();
  while (true) {
    try {
      await relayerMgr.loop();
    }
    catch (e) {
      logger.error(e);
    }
    logger.info(utils.format('Waiting for {0} seconds...', config.get('scanInterval')));
    await utils.sleep(config.get('scanInterval'));
  }
}

main();