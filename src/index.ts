import { SynchronizerMain } from './main';
import { OmniverseServer } from './server';
import { LocalStorage } from './storage/localStorage';
import config from 'config';

async function main() {
  const state = new LocalStorage('./');
  const server = new OmniverseServer(config.get('omniverseServer.rpc'));
  const synchronizer = new SynchronizerMain(state, server);
  synchronizer.init();
  await synchronizer.run();
}

(async () => {
  await main();
})();
