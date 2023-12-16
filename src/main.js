const chainHandlerMgr = require('./basic/chainHandlerMgr');
global.config = require('config');
global.logger = require('./utils/logger');
global.utils = require('./utils/utils');
global.stateDB = require('./utils/stateDB');
const request = require('sync-request');
global.MainLogger = require('./utils/logger').getLogger('main');

async function init() {
  await chainHandlerMgr.init();
  stateDB.init(config.get('stateDB'));
}

async function restoreWork() {
  await chainHandlerMgr.restore();
}

async function main() {
  MainLogger.info("Launch validator node...");
  await init();
  await restoreWork();
  await chainHandlerMgr.run();
  while (true) {
    await chainHandlerMgr.loop();
    MainLogger.info(utils.format('Waiting for {0} seconds...', config.get('scanInterval')));
    await utils.sleep(config.get('scanInterval'));
  }
  MainLogger.error('Exit main can not be arrived');
}

main();

process.on('unhandledRejection', (err) => {
  MainLogger.error('UnhanledRejection', err);
  process.exit();
})

process.on('uncaughtException', (err) => {
  MainLogger.error('UnhanledException', err);
  process.exit();
})