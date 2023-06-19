# Omniverse synchronizer

Omniverse synchronzers are responsible to synchronize omniverse transactions between chains, which apply the Omniverse Protocol

## Prerequisites

- node >= v18.12
- npm >= 8.19.2

## Install

### Clone the repository
```
git clone https://github.com/Omniverse-Web3-Labs/omniverse-synchronizer.git
```

### Install dependencies
```
npm install
```

## Usage

### Configuration

- scanInterval: The interval between two synchronization operations
- logLevel: Log level 
- secret: Where the file of the secret key of porter is stored
- stateDB: Synchronization state
- networks:
    - <EVM_CHAIN_NAME>:
        - omniverseContractAbiPath: Evm contract abi file path
        - compatibleChain: Indicates what kind of chain it is, here is "ethereum"
        - chainId: The chain id of EVM chain
        - omniverseContractAddress: Contract address
        - nodeAddress: Http or websocket endpoints
        - omniverseChainId: The unique chain id for all public chains
    - <INK_CHAIN_NAME>:
        - abiPath: The path of the abi file
        - compatibleChain: "ink"
        - omniverseContractAddress: Contract address
        - nodeAddress: Http or websocket endpoints
        - omniverseChainId: The unique chain id for all public chains

### Launch

```
npm run start
```
