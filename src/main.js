const chainHandlerMgr = require('./basic/chainHandlerMgr');
global.config = require('config');
global.logger = require('./utils/logger');
global.utils = require('./utils/utils');
global.stateDB = require('./utils/stateDB');

async function init() {
  await chainHandlerMgr.init();
  stateDB.init(config.get('stateDB'));
}

async function main() {
  logger.info("Launch validator node...");
  await init();
  await chainHandlerMgr.run();
  while (true) {
    await chainHandlerMgr.loop();
    logger.info(utils.format('Waiting for {0} seconds...', config.get('scanInterval')));
    await utils.sleep(config.get('scanInterval'));
  }
}

main();