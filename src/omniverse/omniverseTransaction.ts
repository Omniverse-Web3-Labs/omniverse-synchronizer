import { OmniTxType, SignedTx, Input, Output } from '../utils/types';
import { Signer } from '../signer/signer';

export interface OmniverseTx {
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

export class OmniverseTransaction implements OmniverseTx {
    feeInputs: Array<Input> = [];
    feeOuputs: Array<Output> = [];
    signature: string = '';
    rawTxData: string = '';
    txIndex: string = '';
    rawTx: SignedTx;

    constructor(tx: SignedTx) {
        this.rawTx = tx;
    }

    getTxType(): OmniTxType {
        return this.rawTx.txType;
    }

    getSignedData(signer: Signer): Promise<SignedTx> {
        const hash = Buffer.from(this.getEIP712Hash(), 'hex');
        const signature = await signer.sign(hash);
        return {
            txIndex: this.txIndex,
            txType: OmniTxType.Deploy,
            txData: this.rawTxData,
            signature: signature
        };
    }
}
