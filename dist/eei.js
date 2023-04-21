'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.ViewOnlyEEI = void 0
const statemanager_1 = require('@ethereumjs/statemanager')
const vmState_1 = require('@ethereumjs/vm/dist/eei/vmState')
// minimal eei that talks to rpc
// not 100% sure if this is sufficient
class ViewOnlyEEI extends vmState_1.VmState {
    common
    stateManager
    url
    constructor(common, url, stateManager) {
        stateManager ??= new statemanager_1.DefaultStateManager()
        super({ common, stateManager })
        this.common = common
        this.stateManager = stateManager
        this.url = url
    }
    getBlockHash(_num) {
        throw new Error('Method not implemented.')
    }
    storageStore(_address, _key, _value) {
        throw new Error('Storage writes are not allowed in view mode.')
    }
    async storageLoad(address, key, _original) {
        const response = await fetch(this.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getStorageAt',
                params: [address.toString(), key.toString('hex'), 'latest'],
                id: 1,
            }),
        })
        const { result } = await response.json()
        return Buffer.from(result.slice(2), 'hex')
    }
    copy() {
        const common = this.common.copy()
        common.setHardfork(this.common.hardfork())
        return new ViewOnlyEEI(common, this.url, this.stateManager.copy())
    }
}
exports.ViewOnlyEEI = ViewOnlyEEI
