const chainHandlerMgr = require('./basic/chainHandlerMgr');
global.config = require('config');
global.logger = require('./utils/logger');
global.utils = require('./utils/utils');
global.stateDB = require('./utils/stateDB');
const request = require('sync-request');

async function init() {
  await chainHandlerMgr.init();
  stateDB.init(config.get('stateDB'));
}

async function restoreWork() {
  await chainHandlerMgr.restore();
}

async function main() {
  logger.info("Launch validator node...");
  await init();
  await restoreWork();
  await chainHandlerMgr.run();
  while (true) {
    await chainHandlerMgr.loop();
    logger.info(utils.format('Waiting for {0} seconds...', config.get('scanInterval')));
    await utils.sleep(config.get('scanInterval'));
  }
  logger.error('Exit main can not be arrived');
}

main();

process.on('unhandledRejection', (err) => {
  logger.error('UnhanledRejection', err);
  process.exit();
})

process.on('uncaughtException', (err) => {
  logger.error('UnhanledException', err);
  process.exit();
})