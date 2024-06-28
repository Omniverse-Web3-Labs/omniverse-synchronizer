import { Contract, eth, Web3 } from 'web3';
import { SignedTx, UnsignedTx } from '../utils';
import config from 'config';
import fs from 'fs';
import { contractCall, sendTransactionWithSigner } from '../utils/ethereum';
import { Signer } from '../signer/Signer';

export class ContractConnector {
  localEntry: Contract<any>;
  web3: Web3;
  signer: Signer;

  constructor(_signer: Signer) {
    this.signer = _signer;
    this.web3 = new Web3(config.get('contracts.localEntry.nodeAddress'));
    let contractAddress = config.get(
      'contracts.localEntry.contractAddress',
    ) as string;
    let contractRawData = fs.readFileSync(
      config.get('contracts.localEntry.contractAbiPath'),
    );
    let contractAbi = JSON.parse(contractRawData.toString()).abi;
    this.localEntry = new this.web3.eth.Contract(contractAbi, contractAddress);
  }

  /**
   * @notice Returns the next unsigned transaction
   * @return Unsigned omniverse transaction data fetched from chain
   */
  async getNextUnsignedTx(): Promise<UnsignedTx | null> {
    const unsignedTx = (await contractCall(
      this.localEntry,
      'getUnsignedTx',
      [],
    )) as any;
    if (
      unsignedTx.txIndex == '0' &&
      unsignedTx.unsignedTx.txid ==
        '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return null;
    } else {
      return {
        txIndex: unsignedTx.txIndex,
        txType: unsignedTx.unsignedTx.otx.txType,
        txData: unsignedTx.unsignedTx.otx.txData,
      };
    }
  }

  async getTransactionByIndex(index: bigint): Promise<SignedTx> {
    const result = (await contractCall(
      this.localEntry,
      'getTransactionByIndex',
      [index],
    )) as any;
    console.log(result);
    return result[1];
  }

  async getTransactionNumber(): Promise<bigint> {
    let result = await contractCall(
      this.localEntry,
      'getTransactionNumber',
      [],
    );
    if (result) {
      return result as bigint;
    } else {
      return BigInt(0);
    }
  }

  /**
   * @notice Returns the public key of the AA signer
   * @return Public key
   */
  async getPubkey(): Promise<string> {
    const pubKey = (await contractCall(
      this.localEntry,
      'getPubkey',
      [],
    )) as any;
    return pubKey as string;
  }

  /**
   * @notice Submits signed omniverse transaction to chain
   * @param tx Signed omniverse transaction
   */
  async submitTx(tx: SignedTx) {
    await sendTransactionWithSigner(
      this.web3,
      config.get('contracts.omniverseAA.chainId'),
      this.localEntry,
      config.get('contracts.omniverseAA.signer'),
      'submitTx',
      [tx.txid, tx.signature],
      this.signer,
    );
  }
}
