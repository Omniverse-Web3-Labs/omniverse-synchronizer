export interface Input {
    txid: string;
    index: string;
    amount: string;
    address: string;
}

export interface Output {
    address: string;
    amount: string;
}

export enum OmniTxType {
    Deploy,
    Mint,
    Transfer
}

export interface Deploy {
    metadata: DeployMetadata;
    signature: string;
    feeInputs: Array<Input>;
    feeOutputs: Array<Output>;
}

export interface Mint {
    assetId: string;
    signature: string;
    outputs: Array<Output>;
    feeInputs: Array<Input>;
    feeOutputs: Array<Output>;
}

export interface Transfer {
    assetId: string;
    signature: string;
    inputs: Array<Input>;
    outputs: Array<Output>;
    feeInputs: Array<Input>;
    feeOutputs: Array<Output>;
}

export interface DeployMetadata {
    salt: string;
    name: string;
    deployer: string;
    limit: string;
    price: string;
    totalSupply: string;
}

export interface UnsignedTx {
    txIndex: string;
    txType: OmniTxType;
    txData: string;
}

export interface SignedTx {
    txIndex: string;
    txType: OmniTxType;
    txData: string;
    signature: string;
}

// abi encoding and decoding
export const ABI_DEPLOY_TYPE = [
    {
        components: [
            {
                components: [
                    {
                        internalType: 'bytes8',
                        name: 'salt',
                        type: 'bytes8'
                    },
                    {
                        internalType: 'string',
                        name: 'name',
                        type: 'string'
                    },
                    {
                        internalType: 'bytes32',
                        name: 'deployer',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'totalSupply',
                        type: 'uint128'
                    },
                    {
                        internalType: 'uint128',
                        name: 'limit',
                        type: 'uint128'
                    },
                    {
                        internalType: 'uint128',
                        name: 'price',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Metadata',
                name: 'metadata',
                type: 'tuple'
            },
            {
                internalType: 'bytes',
                name: 'signature',
                type: 'bytes'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'txid',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint64',
                        name: 'index',
                        type: 'uint64'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    },
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    }
                ],
                internalType: 'struct Types.Input[]',
                name: 'feeInputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Output[]',
                name: 'feeOutputs',
                type: 'tuple[]'
            }
        ],
        internalType: 'struct Types.Deploy',
        name: 'dp',
        type: 'tuple'
    }
];
export const ABI_MINT_TYPE = [
    {
        components: [
            {
                internalType: 'bytes32',
                name: 'assetId',
                type: 'bytes32'
            },
            {
                internalType: 'bytes',
                name: 'signature',
                type: 'bytes'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Output[]',
                name: 'outputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'txid',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint64',
                        name: 'index',
                        type: 'uint64'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    },
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    }
                ],
                internalType: 'struct Types.Input[]',
                name: 'feeInputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Output[]',
                name: 'feeOutputs',
                type: 'tuple[]'
            }
        ],
        internalType: 'struct Types.Mint',
        name: 'mint',
        type: 'tuple'
    }
];
export const ABI_TRANSFER_TYPE = [
    {
        components: [
            {
                internalType: 'bytes32',
                name: 'assetId',
                type: 'bytes32'
            },
            {
                internalType: 'bytes',
                name: 'signature',
                type: 'bytes'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'txid',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint64',
                        name: 'index',
                        type: 'uint64'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    },
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    }
                ],
                internalType: 'struct Types.Input[]',
                name: 'inputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Output[]',
                name: 'outputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'txid',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint64',
                        name: 'index',
                        type: 'uint64'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    },
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    }
                ],
                internalType: 'struct Types.Input[]',
                name: 'feeInputs',
                type: 'tuple[]'
            },
            {
                components: [
                    {
                        internalType: 'bytes32',
                        name: 'address',
                        type: 'bytes32'
                    },
                    {
                        internalType: 'uint128',
                        name: 'amount',
                        type: 'uint128'
                    }
                ],
                internalType: 'struct Types.Output[]',
                name: 'feeOutputs',
                type: 'tuple[]'
            }
        ],
        internalType: 'struct Types.Transfer',
        name: 'transfer',
        type: 'tuple'
    }
];
