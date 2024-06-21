import { Signer } from './Signer';

export class MPCSigner implements Signer {
    constructor() {}

    sign(hash: Buffer): string {
        return '';
    }
}
