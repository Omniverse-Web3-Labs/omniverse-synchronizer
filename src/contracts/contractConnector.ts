import { Contract, eth, Web3 } from 'web3';
import { SignedTx, UnsignedTx } from '../utils/types';
import config from 'config';
import fs from 'fs';
import {
    contractCall,
    sendTransactionWithSigner,
    sendTransaction
} from '../utils/ethereum';
import { Signer } from '../signer/signer';
import RLP from 'rlp';
import { toHex } from 'web3-utils';

export class ContractConnector {
    omniverseAA: Contract<any>;
    web3: Web3;
    signer: Signer;

    constructor(_signer: Signer) {
        this.signer = _signer;
        this.web3 = new Web3(config.get('contracts.omniverseAA.nodeAddress'));
        let contractAddress = config.get(
            'contracts.omniverseAA.contractAddress'
        ) as string;
        let contractRawData = fs.readFileSync(
            config.get('contracts.omniverseAA.contractAbiPath')
        );
        let contractAbi = JSON.parse(contractRawData.toString()).abi;
        this.omniverseAA = new this.web3.eth.Contract(
            contractAbi,
            contractAddress
        );
    }

    /**
     * @notice Returns the next unsigned transaction
     * @return Unsigned omniverse transaction data fetched from chain
     */
    async getNextUnsignedTx(): Promise<UnsignedTx | null> {
        const unsignedTx = (await contractCall(
            this.omniverseAA,
            'getUnsignedTx',
            []
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
                txData: unsignedTx.unsignedTx.otx.txData
            };
        }
    }

    /**
     * @notice Returns the public key of the AA signer
     * @return Public key
     */
    async getPubkey(): Promise<string> {
        const pubKey = (await contractCall(
            this.omniverseAA,
            'getPubkey',
            []
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
            this.omniverseAA,
            config.get('contracts.omniverseAA.signer'),
            'submitTx',
            [tx.txIndex, tx.signature],
            this.signer
        );
    }
}
