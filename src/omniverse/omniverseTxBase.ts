import { OmniTxType, SignedTx, Input, Output } from '../utils/types';
import { Signer } from '../signer/Signer';

export interface OmniverseTx {
  /**
   * @notice Returns the EIP712 hash of the omniverse transaction
   */
  getEIP712Hash(): string;

  /**
   * @notice Returns the omniverse transaction type
   */
  getTxType(): OmniTxType;

  /**
   * @notice Returns the signed data of the omniverse transaction
   * @param signer The signer used to sign omniverse transaction
   */
  getSignedData(signer: Signer): Promise<SignedTx>;
}

export abstract class OmniverseTransactionBase implements OmniverseTx {
  feeInputs: Array<Input> = [];
  feeOuputs: Array<Output> = [];
  signature: string = '';
  rawTxData: string = '';
  txIndex: string = '';

  abstract getEIP712Hash(): string;
  abstract getTxType(): OmniTxType;
  abstract getSignedData(signer: Signer): Promise<SignedTx>;
}
