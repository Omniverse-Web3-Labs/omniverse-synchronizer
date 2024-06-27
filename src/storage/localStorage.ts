import { Storage } from './Storage';
import * as fs from 'fs';

export class LocalStorage implements Storage {
  state: bigint;
  path: fs.PathLike;

  constructor(path: fs.PathLike) {
    this.path = path;
    try {
      fs.accessSync(path, fs.constants.F_OK);
      this.state = BigInt(fs.readFileSync(path, 'utf-8'));
    } catch (e) {
      this.state = BigInt(0);
    }
  }

  getLatestTransactionIndex(): bigint {
    return this.state;
  }

  async storeLatestTransactionIndex(index: bigint) {
    this.state = index;
  }
}
