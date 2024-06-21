import { Signer } from './signer';
import { KMS } from '@aws-sdk/client-kms';
import { Sequence, fromBER } from 'asn1js';
import config from 'config';
import fs from 'fs';

export class KMSSigner implements Signer {
    kms: KMS;

    constructor() {
        this.kms = new KMS({
            region: config.get('signer.KMS.region')
        });
    }

    private handleDecodedData(data: Buffer): Buffer {
        const asn1 = fromBER(data);
        if (asn1.offset === -1) {
            throw new Error('Failed to decode DER data');
        }

        if (asn1.result.constructor.name === 'Sequence') {
            let buffers: Array<Buffer> = [];
            const sequence = asn1.result as Sequence;
            sequence.valueBlock.value.forEach((element: any) => {
                let valueHex = Buffer.from(element.valueBlock.valueHex);
                if (valueHex.length == 33 && valueHex[0] == 0) {
                    valueHex = valueHex.subarray(1);
                }
                buffers.push(valueHex);
            });
            return Buffer.concat(buffers);
        } else {
            throw new Error('Failed to decode DER data');
        }
    }

    async sign(hash: Buffer): Promise<string> {
        return new Promise((res, rej) => {
            const keyId = config.get('signer.KMS.keyId') as string;
            this.kms.sign(
                {
                    KeyId: keyId,
                    MessageType: 'DIGEST',
                    Message: Uint8Array.from(hash),
                    SigningAlgorithm: 'ECDSA_SHA_256'
                },
                (err, data) => {
                    if (err) {
                        rej(err);
                    } else {
                        let signature = this.handleDecodedData(
                            Buffer.from(data!.Signature!)
                        );
                        res(signature.toString('hex'));
                    }
                }
            );
        });
    }
}
