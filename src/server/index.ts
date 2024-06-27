import axios, { AxiosInstance } from 'axios';
const { create } = axios;
import { Deploy, Mint, Transfer } from '../utils';
import { OmniTxType } from '../utils/types';
import { eth } from 'web3';

import {
  ABI_DEPLOY_TYPE,
  ABI_MINT_TYPE,
  ABI_TRANSFER_TYPE,
} from '../utils/types';

export class OmniverseServer {
  url: string;
  axiosInstance: AxiosInstance;

  constructor(url: string) {
    this.url = url;
    this.axiosInstance = create();
  }

  async rpc(method: string, params: any[]): Promise<any> {
    try {
      let response = await this.post({
        jsonrpc: '2.0',
        method: method,
        params,
        id: new Date().getTime(),
      });
      if (response.error) {
        console.error('request error: ', response.error);
      }
      return response.result;
    } catch (e) {
      console.error('network error: ' + e);
      throw e;
    }
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
    signature: string,
  ) {
    let tx;
    if (txType == OmniTxType.Deploy) {
      let txData = eth.abi.decodeParameters(ABI_DEPLOY_TYPE, txRawData)
        .deploy as Deploy;
      tx = {
        ...txData,
        type: 'Deploy',
      };
    } else if (txType == OmniTxType.Mint) {
      let txData = eth.abi.decodeParameters(ABI_MINT_TYPE, txRawData)
        .mint as Mint;
      tx = {
        ...txData,
        type: 'Mint',
      };
    } else if (txType == OmniTxType.Transfer) {
      let txData = eth.abi.decodeParameters(ABI_TRANSFER_TYPE, txRawData)
        .transfer as Transfer;
      tx = {
        ...txData,
        type: 'Transfer',
      };
    }
    await this.rpc('sendTransaction', [tx, signature]);
  }
}
