import { Signer } from './Signer';

export class KMSSigner implements Signer {
    constructor() {}

    sign(hash: Buffer): string {
        return '';
    }
}
