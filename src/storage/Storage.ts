export interface Storage {
  /**
   * @notice Returns the latest synchronized transaction index
   */
  getLatestTransactionIndex(): bigint | null;

  /**
   * @notice Stores the latest synchronized transaction index
   * @param index At which index the task is
   */
  storeLatestTransactionIndex(index: bigint): void;
}
