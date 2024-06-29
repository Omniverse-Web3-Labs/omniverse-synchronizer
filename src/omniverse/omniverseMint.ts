import config, { IConfig } from 'config';
import {
  OmniTxType,
  SignedTx,
  Mint,
  Output,
  ABI_MINT_TYPE,
} from '../utils/types';
import { OmniverseTransactionBase } from './omniverseTxBase';
import { eth } from 'web3';
import { TypedDataUtils } from 'ethers-eip712';
import { Signer } from '../signer/Signer';

export default class OmniverseMint extends OmniverseTransactionBase {
  assetId: string;
  outputs: Array<Output>;
  sysConfig: IConfig;

  constructor(_txid: string, txData: string) {
    super();
    this.txid = _txid;
    this.rawTxData = txData;
    this.sysConfig = config;
    try {
      const params = eth.abi.decodeParameters(ABI_MINT_TYPE, txData);
      const mint: Mint = params.mint as Mint;
      this.assetId = mint.assetId;
      this.outputs = mint.outputs;
      this.feeInputs = mint.feeInputs;
      this.feeOuputs = mint.feeOutputs;
    } catch (e) {
      throw new Error('Mint transaction data error');
    }
  }

  getEIP712Hash(): string {
    let typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Mint: [
          { name: 'asset_id', type: 'bytes32' },
          { name: 'outputs', type: 'Output[]' },
          { name: 'fee_inputs', type: 'Input[]' },
          { name: 'fee_outputs', type: 'Output[]' },
        ],
        Input: [
          { name: 'txid', type: 'bytes32' },
          { name: 'index', type: 'uint32' },
          { name: 'amount', type: 'uint128' },
          { name: 'address', type: 'bytes32' },
        ],
        Output: [
          { name: 'amount', type: 'uint128' },
          { name: 'address', type: 'bytes32' },
        ],
      },
      primaryType: 'Mint' as const,
      domain: {
        name: this.sysConfig.get('EIP712.name') as string,
        version: this.sysConfig.get('EIP712.version') as string,
        chainId: this.sysConfig.get('EIP712.chainId') as number,
        verifyingContract: this.sysConfig.get(
          'EIP712.verifyingContract',
        ) as string,
      },
      message: {
        asset_id: this.assetId,
        outputs: this.outputs,
        fee_inputs: this.feeInputs,
        fee_outputs: this.feeOuputs,
      },
    };
    const digest = TypedDataUtils.encodeDigest(typedData);
    return Buffer.from(digest).toString('hex');
  }

  getTxType(): OmniTxType {
    return OmniTxType.Mint;
  }

  async getSignedData(signer: Signer): Promise<SignedTx> {
    const hash = Buffer.from(this.getEIP712Hash(), 'hex');
    const signature = await signer.sign(hash);
    return {
      txid: this.txid,
      txType: OmniTxType.Mint,
      txData: this.rawTxData,
      signature: signature,
    };
  }
}
