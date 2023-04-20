"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.contract = void 0;
const common_1 = require("@ethereumjs/common");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
const eei_1 = require("./eei");
const solc_1 = require("solc");
const inject_1 = require("./inject");
const sha3_1 = require("sha3");
const TOKEN = process.env.TOKEN;
const ENDPOINT = 'https://api.etherscan.io/api';
const contract = async (address) => {
    const url = new URL(ENDPOINT);
    url.searchParams.append('module', 'contract');
    url.searchParams.append('action', 'getsourcecode');
    url.searchParams.append('address', address);
    url.searchParams.append('apikey', TOKEN);
    const result = await fetch(url.toString());
    const json = await result.json();
    if (json.status !== '1')
        throw new Error('Error fetching contract.');
    if (json.result.length < 1)
        throw new Error('No contracts found.');
    const first = json.result[0];
    // two possible formats
    // handle solidity standard json-input
    if (first['SourceCode'].startsWith('{')) {
        const stripped = first['SourceCode'].slice(1, -1);
        const parsed = JSON.parse(stripped);
        const settings = (parsed) => ({
            optimization: parsed.settings?.optimizer?.enabled ?? false,
            runs: parseInt(parsed.settings?.optimizer?.runs.toString() ?? '0'),
            evm: parsed.evmVersion,
        });
        return new Map(Object.entries(parsed.sources).map(([filename, { content }]) => [
            filename.split('/').at(-1).split('.')[0],
            {
                code: content,
                filename: filename,
                version: first['CompilerVersion'],
                settings: settings(parsed),
            },
        ]));
    }
    return new Map(json.result.map((item) => [
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
    ]));
};
exports.contract = contract;
const execute = async (address, name, patch, nested) => {
    const data = await (0, exports.contract)(address);
    if (!data.has(name))
        throw new Error(`No contract named ${name}.`);
    const { code, filename, version, settings } = data.get(name);
    const { code: patched, name: func } = (0, inject_1.inject)(code, patch, nested ?? name);
    data.set(name, { ...data.get(name), code: patched });
    const options = {
        language: 'Solidity',
        sources: Object.fromEntries([...data.entries()].map(([name, { code, filename }]) => [
            filename ?? `${name}.sol`,
            { content: code },
        ])),
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
    };
    const solc = await new Promise((resolve, reject) => (0, solc_1.loadRemoteVersion)(version, (error, solc) => error ? reject(error) : resolve(solc)));
    const output = JSON.parse(solc.compile(JSON.stringify(options)));
    if (output.contracts === undefined)
        throw new Error('Compilation error.');
    const parsed = output.contracts[filename ?? `${name}.sol`][name];
    const bytecode = parsed.evm.deployedBytecode.object;
    const common = new common_1.Common({ chain: 'mainnet' });
    const eei = new eei_1.ViewOnlyEEI(common, 'https://eth.llamarpc.com');
    const evm = new evm_1.EVM({ common, eei });
    const bytes = Buffer.from(bytecode, 'hex');
    const selector = Buffer.from(new sha3_1.Keccak(256).update(`${func}()`).digest('hex').slice(0, 8), 'hex');
    const result = await evm.runCode({
        code: bytes,
        gasLimit: BigInt('0xffffffff'),
        address: util_1.Address.fromString(address),
        data: selector,
    });
    return result.returnValue;
};
exports.execute = execute;