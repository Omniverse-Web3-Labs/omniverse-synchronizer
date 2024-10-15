import { SynchronizerMain } from './main';
import { OmniverseServer } from './server';
import { LocalStorage } from './storage/localStorage';
import config from 'config';
import { LocalSigner } from './signer/localSigner';

async function main() {
  const state = new LocalStorage('./storage/.state');
  const server = new OmniverseServer(config.get('omniverseServer.rpc'));
  const signer = new LocalSigner(config.get('secret'));
  const synchronizer = new SynchronizerMain(signer, state, server);
  synchronizer.init();
  await synchronizer.run();
}

(async () => {
  await main();
})();
