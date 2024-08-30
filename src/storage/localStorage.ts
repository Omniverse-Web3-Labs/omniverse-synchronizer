import { Storage } from './Storage';
import * as fs from 'fs';

export class LocalStorage implements Storage {
  state: bigint | null;
  path: fs.PathLike;

  constructor(path: fs.PathLike) {
    this.path = path;
    try {
      fs.accessSync(path, fs.constants.F_OK);
      // console.log(fs.readFileSync(path, 'utf-8'));
      this.state = BigInt(fs.readFileSync(path, 'utf-8'));
    } catch (e) {
      this.state = null;
    }
  }

  getLatestTransactionIndex(): bigint | null {
    return this.state;
  }

  async storeLatestTransactionIndex(index: bigint) {
    this.state = index;
    fs.writeFileSync(this.path, this.state.toString());
  }
}
