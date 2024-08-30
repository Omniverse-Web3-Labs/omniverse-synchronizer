import { Signer } from './Signer';

export class MPCSigner implements Signer {
  constructor() {}

  async sign(hash: Buffer): Promise<string> {
    return '';
  }
}
