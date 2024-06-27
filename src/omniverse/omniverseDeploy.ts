import { OmniTxType, SignedTx, DeployMetadata } from '../utils/types';
import { OmniverseTransactionBase } from './omniverseTxBase';
import { eth } from 'web3';
import { TypedDataUtils } from 'ethers-eip712';
import config, { IConfig } from 'config';
import { Deploy, ABI_DEPLOY_TYPE } from '../utils/types';
import { Signer } from '../signer/Signer';

export default class OmniverseDeploy extends OmniverseTransactionBase {
  metadata: DeployMetadata;
  sysConfig: IConfig;

  constructor(_txIndex: string, txData: string) {
    super();
    this.txIndex = _txIndex;
    this.rawTxData = txData;
    this.sysConfig = config;
    try {
      const params = eth.abi.decodeParameters(ABI_DEPLOY_TYPE, txData);
      const deploy: Deploy = params.dp as Deploy;
      this.metadata = deploy.metadata;
      this.feeInputs = deploy.feeInputs;
      this.feeOuputs = deploy.feeOutputs;
    } catch (e) {
      throw new Error('Deploy transaction data error');
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
        Deploy: [
          { name: 'salt', type: 'bytes8' },
          { name: 'name', type: 'string' },
          { name: 'deployer', type: 'bytes32' },
          { name: 'limit', type: 'uint128' },
          { name: 'price', type: 'uint128' },
          { name: 'total_supply', type: 'uint128' },
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
      primaryType: 'Deploy' as const,
      domain: {
        name: this.sysConfig.get('EIP712.name') as string,
        version: this.sysConfig.get('EIP712.version') as string,
        chainId: this.sysConfig.get('EIP712.chainId') as number,
        verifyingContract: this.sysConfig.get(
          'EIP712.verifyingContract',
        ) as string,
      },
      message: {
        salt: this.metadata.salt,
        name: this.metadata.name,
        deployer: this.metadata.deployer,
        total_supply: this.metadata.totalSupply,
        limit: this.metadata.limit,
        price: this.metadata.price,
        fee_inputs: this.feeInputs,
        fee_outputs: this.feeOuputs,
      },
    };
    const digest = TypedDataUtils.encodeDigest(typedData);
    return Buffer.from(digest).toString('hex');
  }

  getTxType(): OmniTxType {
    return OmniTxType.Deploy;
  }

  async getSignedData(signer: Signer): Promise<SignedTx> {
    const hash = Buffer.from(this.getEIP712Hash(), 'hex');
    const signature = await signer.sign(hash);
    return {
      txIndex: this.txIndex,
      txType: OmniTxType.Deploy,
      txData: this.rawTxData,
      signature: signature,
    };
  }
}
