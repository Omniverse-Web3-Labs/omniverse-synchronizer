// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./OmniverseData.sol";

library OmniverseProtocol {
    /**
     * @dev Get the hash of a tx
     */
    function getTransactionHash(OmniverseTokenProtocol memory _data) internal pure returns (bytes32) {
        bytes memory bData;
        (uint8 op, bytes memory wrappedData) = abi.decode(_data.data, (uint8, bytes));
        if (op == WITHDRAW) {
            (uint256 amount) = abi.decode(wrappedData, (uint256));
            bData = abi.encodePacked(op, uint128(amount));
        }
        else if (op == TRANSFER) {
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            bData = abi.encodePacked(op, to, uint128(amount));
        }
        else if (op == DEPOSIT) {
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            bData = abi.encodePacked(op, to, uint128(amount));
        }
        else if (op == MINT) {
            (bytes memory to, uint256 amount) = abi.decode(wrappedData, (bytes, uint256));
            bData = abi.encodePacked(op, to, uint128(amount));
        }
        bytes memory rawData = abi.encodePacked(uint128(_data.nonce), _data.chainId, _data.from, _data.to, bData);
        return keccak256(rawData);
    }

    /**
     * @dev Recover the address
     */
    function recoverAddress(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        uint8 v;
        bytes32 r;
        bytes32 s;
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := mload(add(_signature, 65))
        }
        address recovered = ecrecover(_hash, v, r, s);
        require(recovered != address(0), "Signature verifying failed");
        return recovered;
    }

    /**
     * @dev Check if the public key matches the recovered address
     */
    function checkPkMatched(bytes memory _pk, address _address) internal pure {
        bytes32 hash = keccak256(_pk);
        address pkAddress = address(uint160(uint256(hash)));
        require(_address == pkAddress, "Sender not signer");
    }
}