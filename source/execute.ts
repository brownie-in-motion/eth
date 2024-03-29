import { Common } from '@ethereumjs/common'
import { EVM } from '@ethereumjs/evm'
import { Address } from '@ethereumjs/util'
import { ViewOnlyEEI } from './eei'
import { loadRemoteVersion, Solc } from 'solc'
import { inject } from './inject'
import { Keccak } from 'sha3'

const TOKEN = process.env.TOKEN!
const ENDPOINT = 'https://api.etherscan.io/api'
const RPC = 'https://cloudflare-eth.com'
const CACHE = 100

export type Contract = {
    code: string
    filename?: string
    version: string
    settings: {
        optimization: boolean
        runs: number
        evm?: string
    }
}

export type SolidityOptions = {
    language: string
    sources: {
        [filename: string]: {
            content?: string
        }
    }
    settings?: {
        optimizer?: {
            enabled: boolean
            runs: number | string
        }
    }
    evmVersion: string
}

export type ContractInfo = {
    name: string
    contracts: Map<string, Contract>
}

class Ring<T> {
    data: T[] = []
    index: number = -1
    drop?: (data: T) => void

    constructor(public size: number) {
        this.data = new Array(size)
    }

    onDrop(callback: (data: T) => void) {
        this.drop = callback
    }

    push(data: T) {
        this.index = (this.index + 1) % this.size
        if (this.data[this.index] !== undefined) {
            this.drop?.(this.data[this.index])
        }
        this.data[this.index] = data
    }
}

const cache = new Map<string, ContractInfo>()
const queue = new Ring<string>(CACHE)
queue.onDrop(cache.delete.bind(cache))

// does not optimize concurrent requests
// we can eat that though
export const contract = async (address: string): Promise<ContractInfo> => {
    const normalized = Address.fromString(address).toString()
    if (cache.has(normalized)) return structuredClone(cache.get(normalized)!)
    const result = await inner(normalized)
    cache.set(normalized, result)
    queue.push(normalized)
    return structuredClone(result)
}

const inner = async (address: string): Promise<ContractInfo> => {
    const url = new URL(ENDPOINT)
    url.searchParams.append('module', 'contract')
    url.searchParams.append('action', 'getsourcecode')
    url.searchParams.append('address', address)
    url.searchParams.append('apikey', TOKEN)

    const result = await fetch(url.toString())
    const json = await result.json()

    if (json.status !== '1') throw new Error('Error fetching contract.')
    if (json.result.length < 1) throw new Error('No contracts found.')

    const first = json.result[0]
    const name = first['ContractName']

    // two possible formats
    // handle solidity standard json-input
    if (first['SourceCode'].startsWith('{')) {
        const stripped = first['SourceCode'].slice(1, -1)
        const parsed = JSON.parse(stripped) as SolidityOptions

        const settings = (parsed: SolidityOptions) => ({
            optimization: parsed.settings?.optimizer?.enabled ?? false,
            runs: parseInt(parsed.settings?.optimizer?.runs.toString() ?? '0'),
            evm: parsed.evmVersion,
        })

        return {
            name,
            contracts: new Map(
                Object.entries(parsed.sources).map(
                    ([filename, { content }]) => [
                        filename.split('/').at(-1)!,
                        {
                            code: content!,
                            filename: filename,
                            version: first['CompilerVersion'],
                            settings: settings(parsed),
                        },
                    ]
                )
            ),
        }
    }

    return {
        name,
        contracts: new Map(
            json.result.map((item: any) => [
                `${item['ContractName']}.sol`,
                {
                    code: item['Implementation'] || item['SourceCode'],
                    version: item['CompilerVersion'],
                    settings: {
                        optimization: Boolean(
                            parseInt(item['OptimizationUsed'])
                        ),
                        runs: parseInt(item['Runs']),
                        evm: item['EVMVersion'],
                    },
                },
            ])
        ),
    }
}

export const execute = async (
    address: string,
    file: string,
    patch: string,
    nested?: string
): Promise<Buffer> => {
    const { name, contracts: data } = await contract(address)
    if (!data.has(file)) throw new Error(`No contract named ${file}.`)

    const { code } = data.get(file)!
    const { filename, version, settings } = data.get(`${name}.sol`)!
    const { code: patched, name: func } = inject(code, patch, nested ?? name)

    data.set(file, { ...data.get(file)!, code: patched })

    if (settings?.evm?.toLowerCase() === 'default') settings.evm = undefined

    const options = {
        language: 'Solidity',
        sources: Object.fromEntries(
            [...data.entries()].map(([name, { code, filename }]) => [
                filename ?? name,
                { content: code },
            ])
        ),
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
            optimizer: {
                enabled: settings.optimization,
                runs: settings.runs,
            },
        },
        evmVersion: settings.evm,
    }

    const solc: Solc = await new Promise((resolve, reject) =>
        loadRemoteVersion(version, (error, solc) =>
            error ? reject(error) : resolve(solc)
        )
    )

    const output = JSON.parse(solc.compile(JSON.stringify(options)))

    if (output.contracts === undefined) {
        const error = output.errors?.filter(
            (error: any) => error.severity === 'error'
        )?.[0]
        throw new Error(`Compilation error: ${error.message ?? 'unknown.'}`)
    }

    const parsed = output.contracts[filename ?? `${name}.sol`][name]
    const bytecode = parsed.evm.deployedBytecode.object

    const common = new Common({ chain: 'mainnet' })
    const eei = new ViewOnlyEEI(common, RPC)
    const evm = new EVM({ common, eei })
    const bytes = Buffer.from(bytecode, 'hex')

    const selector = Buffer.from(
        new Keccak(256).update(`${func}()`).digest('hex').slice(0, 8),
        'hex'
    )

    const result = await evm.runCode({
        code: bytes,
        gasLimit: BigInt('0xffffffff'),
        address: Address.fromString(address),
        data: selector,
    })

    return result.returnValue
}
