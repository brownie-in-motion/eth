import { Common } from '@ethereumjs/common'
import { EVM } from '@ethereumjs/evm'
import { Address } from '@ethereumjs/util'
import { ViewOnlyEEI } from './eei'
import { loadRemoteVersion, Solc } from 'solc'
import { inject } from './inject'
import { Keccak } from 'sha3'

const TOKEN = process.env.TOKEN!
const ENDPOINT = 'https://api.etherscan.io/api'

export type Contract = {
    code: string
    filename?: string
    version: string
    settings: {
        optimization: boolean
        runs: number
        evm: string
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

export const contract = async (
    address: string
): Promise<Map<string, Contract>> => {
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

        return new Map(
            Object.entries(parsed.sources).map(([filename, { content }]) => [
                filename.split('/').at(-1)!.split('.')[0],
                {
                    code: content!,
                    filename: filename,
                    version: first['CompilerVersion'],
                    settings: settings(parsed),
                },
            ])
        )
    }

    return new Map(
        json.result.map((item: any) => [
            item['ContractName'],
            {
                code: item['Implementation'] || item['SourceCode'],
                version: item['CompilerVersion'],
                settings: {
                    optimization: Boolean(parseInt(item['OptimizationUsed'])),
                    runs: parseInt(item['Runs']),
                    evm: item['EVMVersion'],
                },
            },
        ])
    )
}

export const execute = async (
    address: string,
    name: string,
    patch: string,
    nested?: string,
): Promise<Buffer> => {
    const data = await contract(address)
    if (!data.has(name)) throw new Error(`No contract named ${name}.`)

    const { code, filename, version, settings } = data.get(name)!
    const { code: patched, name: func } = inject(code, patch, nested ?? name)

    data.set(name, { ...data.get(name)!, code: patched })

    const options = {
        language: 'Solidity',
        sources: Object.fromEntries(
            [...data.entries()].map(([name, { code, filename }]) => [
                filename ?? `${name}.sol`,
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

    if (output.contracts === undefined) throw new Error('Compilation error.')

    const parsed = output.contracts[filename ?? `${name}.sol`][name]
    const bytecode = parsed.evm.deployedBytecode.object

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
        gasLimit: BigInt('0xffffffff'),
        address: Address.fromString(address),
        data: selector,
    })

    return result.returnValue
}
