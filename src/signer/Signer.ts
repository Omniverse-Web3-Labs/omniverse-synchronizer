export interface Signer {
  /**
   * @notice Signs a 32-bytes message
   * @return {Buffer} 32-bytes-length message hash
   */
  sign(hash: Buffer): Promise<string>;
}
