import { EEI } from '@ethereumjs/vm'
/* import type { EEIInterface } from '@ethereumjs/evm' */ // no typescript lol

export class CustomEEI extends EEI /* implements EEIInterface */ {
  protected _common: Common
  protected _blockchain: Blockchain

  constructor(stateManager: StateManager, common: Common, blockchain: Blockchain) {
    super({ common, stateManager })
    this._common = common
    this._blockchain = blockchain
  }

  /**
   * Returns balance of the given account.
   * @param address - Address of account
   */
  async getExternalBalance(address: Address): Promise<bigint> {
    const account = await this.getAccount(address)
    return account.balance
  }

  /**
   * Get size of an account’s code.
   * @param address - Address of account
   */
  async getExternalCodeSize(address: Address): Promise<bigint> {
    const code = await this.getContractCode(address)
    return BigInt(code.length)
  }

  /**
   * Returns code of an account.
   * @param address - Address of account
   */
  async getExternalCode(address: Address): Promise<Buffer> {
    return this.getContractCode(address)
  }

  /**
   * Returns Gets the hash of one of the 256 most recent complete blocks.
   * @param num - Number of block
   */
  async getBlockHash(num: bigint): Promise<bigint> {
    const block = await this._blockchain.getBlock(Number(num))
    return bufferToBigInt(block!.hash())
  }

  /**
   * Storage 256-bit value into storage of an address
   * @param address Address to store into
   * @param key Storage key
   * @param value Storage value
   */
  async storageStore(address: Address, key: Buffer, value: Buffer): Promise<void> {
    await this.putContractStorage(address, key, value)
  }

  /**
   * Loads a 256-bit value to memory from persistent storage.
   * @param address Address to get storage key value from
   * @param key Storage key
   * @param original If true, return the original storage value (default: false)
   */
  async storageLoad(address: Address, key: Buffer, original = false): Promise<Buffer> {
    if (original) {
      return this.getOriginalContractStorage(address, key)
    } else {
      return this.getContractStorage(address, key)
    }
  }

  public copy() {
    const common = this._common.copy()
    common.setHardfork(this._common.hardfork())
    return new EEI(this._stateManager.copy(), common, this._blockchain.copy())
  }
}