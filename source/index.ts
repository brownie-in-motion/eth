import { Common } from '@ethereumjs/common'
import { EVM } from '@ethereumjs/evm'
import { Address } from '@ethereumjs/util'
import { ViewOnlyEEI } from './eei'
import { readFileSync } from 'fs'
import { loadRemoteVersion, Solc } from 'solc'
import { inject } from './inject'
import { Keccak } from 'sha3'
;(async () => {
    const version = 'v0.4.19+commit.c4cbbb05'
    const address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    const filename = 'WETH9.sol'
    const name = 'WETH9'
    const contract = readFileSync(`./contracts/${filename}`, 'utf8')

    const patch = `
        (uint256) {
            return bytes(name).length + decimals;
        }
    `

    const { code, name: func } = inject(contract, patch, 'WETH9')
    const options = {
        language: 'Solidity',
        sources: {
            [filename]: {
                content: code,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    }

    const solc: Solc = await new Promise((resolve, reject) =>
        loadRemoteVersion(version, (error, solc) =>
            error ? reject(error) : resolve(solc)
        )
    )

    const output = JSON.parse(solc.compile(JSON.stringify(options)))
    const data = output.contracts[filename][name].evm
    const bytecode = data.deployedBytecode.object

    const common = new Common({ chain: 'mainnet' })
    const eei = new ViewOnlyEEI(common, 'https://eth.llamarpc.com')
    const evm = new EVM({ common, eei })
    const bytes = Buffer.from(bytecode, 'hex')

    const selector = Buffer.from(
        new Keccak(256).update(`${func}()`).digest('hex').slice(0, 8),
        'hex'
    )

    const result = await evm.runCode({
        code: bytes,
        data: selector,
        address: Address.fromString(address),
        gasLimit: BigInt(1000000),
    })

    console.log(result.returnValue)
})()
