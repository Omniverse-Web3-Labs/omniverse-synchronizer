export interface Storage {
    /**
     * @notice Returns the latest synchronized task information
     * @return {object?} The latest task info
     * {
     *  index,  // At which index the latest task is
     *  txid    // The transaction id of the latest transaction
     * }
     */
    getLatestTaskInfo(): Promise<{
        index: bigint,
        txid: string
    }>;

    /**
     * @notice Stores new synchronization task information
     * @param index At which index the task is
     * @param txid The transaction id of the task
     */
    storeTask(index: bigint, txid: string): Promise<void>;
}