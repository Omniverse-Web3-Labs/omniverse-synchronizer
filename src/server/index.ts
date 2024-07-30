import axios, { AxiosInstance } from 'axios';
const { create } = axios;
import { Deploy, Mint, Transfer, OmniTxType, toObject } from '../utils';
import { eth } from 'web3';

import {
  ABI_DEPLOY_TYPE,
  ABI_MINT_TYPE,
  ABI_TRANSFER_TYPE,
} from '../utils/types';
import {} from '../utils';

export class OmniverseServer {
  url: string;
  axiosInstance: AxiosInstance;

  constructor(url: string) {
    this.url = url;
    this.axiosInstance = create();
  }

  async rpc(method: string, params: any[]): Promise<any> {
    let response = await this.post({
      jsonrpc: '2.0',
      method: method,
      params,
      id: new Date().getTime(),
    });
    if (response.error) {
      console.error('request error: ', response.error);
      throw Error(response.error.message);
    }
    return response.result;
  }

  async post(params: Object): Promise<any> {
    const response = await this.axiosInstance.post(this.url, params);
    return response.data;
  }

  async containsTx(txid: string): Promise<Boolean> {
    let res = await this.rpc('getTransactionDetail', [txid]);
    if (res) {
      return true;
    } else {
      return false;
    }
  }

  async sendTransaction(
    txType: OmniTxType,
    txRawData: string,
    synchronizerSignature: string,
  ) {
    let tx;
    if (txType == OmniTxType.Deploy) {
      let result = eth.abi.decodeParameters(ABI_DEPLOY_TYPE, txRawData).deploy;
      let txData = toObject(result, null);
      tx = {
        ...txData,
        type: 'Deploy',
      };
    } else if (txType == OmniTxType.Mint) {
      let result = eth.abi.decodeParameters(ABI_MINT_TYPE, txRawData).mint;
      let txData = toObject(result, null);
      tx = {
        ...txData,
        type: 'Mint',
      };
    } else if (txType == OmniTxType.Transfer) {
      let result = eth.abi.decodeParameters(
        ABI_TRANSFER_TYPE,
        txRawData,
      ).transfer;
      let txData = toObject(result, null);
      tx = {
        ...txData,
        type: 'Transfer',
      };
    }
    // console.log(tx, synchronizerSignature);
    await this.rpc('sendTransaction', [tx, synchronizerSignature]);
  }
}
