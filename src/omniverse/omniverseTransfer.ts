import {
  OmniTxType,
  SignedTx,
  Input,
  Output,
  ABI_TRANSFER_TYPE,
  Transfer,
} from '../utils/types';
import { OmniverseTransactionBase } from './omniverseTxBase';
import { eth } from 'web3';
import { TypedDataUtils } from 'ethers-eip712';
import config, { IConfig } from 'config';
import { Signer } from '../signer/Signer';

export default class OmniverseTransfer extends OmniverseTransactionBase {
  assetId: string;
  inputs: Array<Input>;
  outputs: Array<Output>;
  sysConfig: IConfig;

  constructor(_txIndex: string, txData: string) {
    super();
    this.txIndex = _txIndex;
    this.rawTxData = txData;
    this.sysConfig = config;
    try {
      const params = eth.abi.decodeParameters(ABI_TRANSFER_TYPE, txData);
      const mint: Transfer = params.transfer as Transfer;
      this.assetId = mint.assetId;
      this.inputs = mint.inputs;
      this.outputs = mint.outputs;
      this.feeInputs = mint.feeInputs;
      this.feeOuputs = mint.feeOutputs;
    } catch (e) {
      throw new Error('Transfer transaction data error');
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
        Transfer: [
          { name: 'asset_id', type: 'bytes32' },
          { name: 'inputs', type: 'Input[]' },
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
      primaryType: 'Transfer' as const,
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
        inputs: this.inputs,
        outputs: this.outputs,
        fee_inputs: this.feeInputs,
        fee_outputs: this.feeOuputs,
      },
    };
    const digest = TypedDataUtils.encodeDigest(typedData);
    return Buffer.from(digest).toString('hex');
  }

  getTxType(): OmniTxType {
    return OmniTxType.Transfer;
  }

  async getSignedData(signer: Signer): Promise<SignedTx> {
    const hash = Buffer.from(this.getEIP712Hash(), 'hex');
    const signature = await signer.sign(hash);
    return {
      txIndex: this.txIndex,
      txType: OmniTxType.Transfer,
      txData: this.rawTxData,
      signature: signature,
    };
  }
}
