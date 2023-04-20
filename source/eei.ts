import { Common } from '@ethereumjs/common'
import { EEIInterface } from '@ethereumjs/evm'
import { DefaultStateManager, StateManager } from '@ethereumjs/statemanager'
import { Address } from '@ethereumjs/util'
import { VmState } from '@ethereumjs/vm/dist/eei/vmState'

// minimal eei that talks to rpc
// not 100% sure if this is sufficient

export class ViewOnlyEEI extends VmState implements EEIInterface {
    common: Common
    stateManager: StateManager
    url: string

    constructor(common: Common, url: string, stateManager?: StateManager) {
        stateManager ??= new DefaultStateManager()
        super({ common, stateManager })
        this.common = common
        this.stateManager = stateManager
        this.url = url
    }

    getBlockHash(_num: bigint): Promise<bigint> {
        throw new Error('Method not implemented.')
    }

    storageStore(
        _address: Address,
        _key: Buffer,
        _value: Buffer
    ): Promise<void> {
        throw new Error('Storage writes are not allowed in view mode.')
    }

    async storageLoad(
        address: Address,
        key: Buffer,
        _original: boolean
    ): Promise<Buffer> {
        const response = await fetch(this.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getStorageAt',
                params: [
                    address.toString(),
                    key.toString('hex'),
                    'latest',
                ],
                id: 1,
            }),
        })

        const { result } = await response.json()
        return Buffer.from(result.slice(2), 'hex')
    }

    copy(): EEIInterface {
        const common = this.common.copy()
        common.setHardfork(this.common.hardfork())
        return new ViewOnlyEEI(common, this.url, this.stateManager.copy())
    }
}
