import { ContractConnector } from './contracts/contractConnector';
import {
  OmniverseDeploy,
  OmniverseMint,
  OmniverseTransactionFactory,
  OmniverseTransfer,
} from './omniverse';
import { OmniTxType, sendTransaction, sleep } from './utils';
import config from 'config';
import { KMSSigner } from './signer/KMSSigner';
import { Signer } from './signer/Signer';
import { LocalStorage } from './storage/localStorage';
import { Storage } from './storage/Storage';
import { OmniverseServer } from './server';
import { eth } from 'web3';

export class SynchronizerMain {
  contractConnector: ContractConnector;
  // omniverseTxFactory: OmniverseTransactionFactory;
  signer: Signer;
  storage: Storage;
  server: OmniverseServer;

  constructor(storage: Storage, server: OmniverseServer) {
    // this.omniverseTxFactory = new OmniverseTransactionFactory();
    this.signer = new KMSSigner();
    this.contractConnector = new ContractConnector(this.signer);
    this.storage = storage;
    this.server = server;
  }

  init() {}

  async mainLoop() {
    try {
      let nextTransactionIndex: bigint =
        this.storage.getLatestTransactionIndex();
      if (nextTransactionIndex > BigInt(0)) {
        nextTransactionIndex += BigInt(1);
      }
      const signedTxNumber =
        await this.contractConnector.getTransactionNumber();
      console.log(signedTxNumber);
      if (signedTxNumber > nextTransactionIndex) {
        let signedTx =
          await this.contractConnector.getTransactionByIndex(
            nextTransactionIndex,
          );
        console.log('SignedTx transaction found', signedTx);
        if (await this.server.containsTx(signedTx.txid)) {
          console.log(
            'txid:',
            signedTx.txid,
            ', index:',
            nextTransactionIndex,
            ', already synchronized',
          );
        } else {
          let tx;
          if (signedTx.txType == OmniTxType.Transfer) {
            tx = new OmniverseTransfer(signedTx.txid, signedTx.txData);
          } else if (signedTx.txType == OmniTxType.Mint) {
            tx = new OmniverseMint(signedTx.txid, signedTx.txData);
          } else if (signedTx.txType == OmniTxType.Deploy) {
            tx = new OmniverseDeploy(signedTx.txid, signedTx.txData);
          }
          if (tx) {
            let txEIP712Hash = tx.getEIP712Hash();
            let signature = await this.signer.sign(Buffer.from(txEIP712Hash));
            await this.server.sendTransaction(
              signedTx.txType,
              signedTx.txData,
              signature,
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Main loop catch error: ', error.message);
    }
  }

  async run() {
    while (true) {
      await this.mainLoop();
      await sleep(config.get('scanInterval'));
    }
  }
}
