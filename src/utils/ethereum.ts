import Web3, { Contract } from 'web3';
import RLP from 'rlp';
import { keccak256, toHex } from 'web3-utils';

import { decodeContractErrorData } from 'web3-eth-abi';
import { Eip838ExecutionError } from 'web3-errors';
import { Signer } from '../signer/Signer';

export async function deployContract(
  provider: Web3,
  chainId: string,
  targetContract: Contract<any>,
  bytecode: string,
  accountPrivateKey: string,
  argus: Array<any>,
) {
  const account =
    provider.eth.accounts.privateKeyToAccount(accountPrivateKey).address;
  const to = targetContract.options.address;
  const nonce = provider.utils.numberToHex(
    await provider.eth.getTransactionCount(account),
  );
  const data = targetContract
    .deploy({
      data: bytecode,
      arguments: argus,
    })
    .encodeABI(); // encode ABI
  const estimateGas = await provider.eth.estimateGas({ from: account, data });

  let { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
    await provider.eth.calculateFeeData();
  const tx = {
    account,
    chainId,
    data,
    nonce,
    gasLimit: estimateGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
  // console.log(tx);

  let signTx = await provider.eth.accounts.signTransaction(
    tx,
    accountPrivateKey,
  );
  let ret = await provider.eth.sendSignedTransaction(signTx.rawTransaction);
  console.log(`deploy gasUsed:  + ${ret.gasUsed}`);
  return ret;
}

export async function sendTransaction(
  provider: Web3,
  chainId: string,
  targetContract: Contract<any>,
  methodName: string,
  accountPrivateKey: string,
  argus: Array<any>,
) {
  // try {
  const account =
    provider.eth.accounts.privateKeyToAccount(accountPrivateKey).address;
  const to = targetContract.options.address;
  const nonce = provider.utils.numberToHex(
    await provider.eth.getTransactionCount(account),
  );
  const data = targetContract.methods[methodName]
    .apply(targetContract.methods, argus)
    .encodeABI(); // encode ABI
  const estimateGas = await provider.eth.estimateGas({
    from: account,
    to,
    data,
  });

  let { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
    await provider.eth.calculateFeeData();
  const tx = {
    account,
    to,
    chainId,
    data,
    nonce,
    gasLimit: estimateGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
  // console.log(tx);

  let signTx = await provider.eth.accounts.signTransaction(
    tx,
    accountPrivateKey,
  );
  let ret = await provider.eth.sendSignedTransaction(signTx.rawTransaction);
  console.log(`${methodName} gasUsed: ${ret.gasUsed}`);
  return ret;
}

export async function sendTransactionWithSigner(
  provider: Web3,
  chainId: string,
  targetContract: Contract<any>,
  from: string,
  methodName: string,
  argus: Array<any>,
  signer: Signer,
) {
  // try {
  const to = targetContract.options.address;
  const nonce = provider.utils.numberToHex(
    await provider.eth.getTransactionCount(from),
  );
  const data = targetContract.methods[methodName]
    .apply(targetContract.methods, argus)
    .encodeABI(); // encode ABI
  const estimateGas = await provider.eth.estimateGas({ from, to, data });
  let { gasPrice, maxFeePerGas, maxPriorityFeePerGas } =
    await provider.eth.calculateFeeData();
  const tx = {
    from,
    to,
    chainId,
    data,
    nonce,
    gasLimit: estimateGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
  // console.log(tx);

  const encodedTx = Buffer.concat([
    Buffer.from([2]),
    Buffer.from(
      RLP.encode([
        parseInt(tx.chainId),
        parseInt(tx.nonce),
        tx.maxPriorityFeePerGas!,
        tx.maxFeePerGas!,
        tx.gasLimit,
        tx.to !== undefined ? tx.to : Uint8Array.from([]),
        '0x',
        data,
        [],
      ]),
    ),
  ]);
  const txHash = keccak256(encodedTx);
  const signature =
    '0x' + (await signer.sign(Buffer.from(txHash.substring(2), 'hex')));

  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  const v = '0x' + signature.slice(130, 132);

  // Create the raw transaction
  const rawTransaction = Buffer.concat([
    Buffer.from([2]),
    Buffer.from(
      RLP.encode([
        parseInt(tx.chainId),
        parseInt(tx.nonce),
        tx.maxPriorityFeePerGas!,
        tx.maxFeePerGas!,
        tx.gasLimit,
        tx.to !== undefined ? tx.to : Uint8Array.from([]),
        '0x',
        data,
        [],
        v,
        r,
        s,
      ]),
    ),
  ]);

  let ret = await provider.eth.sendSignedTransaction(
    '0x' + Buffer.from(rawTransaction).toString('hex'),
  );
  console.log(`${methodName} gasUsed: ${ret.gasUsed}`);
  return ret;
}

// query info from blockchain node
export async function contractCall(
  targetContract: Contract<any>,
  method: string,
  args: Array<any>,
): Promise<any | null> {
  try {
    let methodObj = targetContract.methods[method].apply(
      targetContract.methods,
      args,
    );
    let ret = await methodObj.call({});
    return ret;
  } catch (e) {
    console.log('e', e);
    console.trace();
    return null;
  }
}
