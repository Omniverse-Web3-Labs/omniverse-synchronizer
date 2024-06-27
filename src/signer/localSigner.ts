import { Signer } from './Signer';
import fs from 'fs';
import { ecdsaSign } from 'secp256k1';
import config from 'config';
import { hexStringtoBytesArray } from '../utils';

export class LocalSigner implements Signer {
  privateKey: Buffer;

  constructor(secretFile: fs.PathLike) {
    let secret = fs.readFileSync(config.get('secret'), 'utf-8');
    this.privateKey = Buffer.from(hexStringtoBytesArray(secret));
  }

  async sign(hash: Buffer): Promise<string> {
    let signature = ecdsaSign(hash, this.privateKey);
    return (
      '0x' +
      Buffer.from(signature.signature).toString('hex') +
      (signature.recid == 0 ? '1b' : '1c')
    );
  }
}
