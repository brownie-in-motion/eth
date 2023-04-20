"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@ethereumjs/common");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
const eei_1 = require("./eei");
const fs_1 = require("fs");
const solc_1 = require("solc");
const inject_1 = require("./inject");
const sha3_1 = require("sha3");
(async () => {
    const version = 'v0.4.19+commit.c4cbbb05';
    const address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const filename = 'WETH9.sol';
    const name = 'WETH9';
    const contract = (0, fs_1.readFileSync)(`./contracts/${filename}`, 'utf8');
    const patch = `
        (uint256) {
            return bytes(name).length + decimals;
        }
    `;
    const { code, name: func } = (0, inject_1.inject)(contract, patch, 'WETH9');
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
    };
    const solc = await new Promise((resolve, reject) => (0, solc_1.loadRemoteVersion)(version, (error, solc) => error ? reject(error) : resolve(solc)));
    const output = JSON.parse(solc.compile(JSON.stringify(options)));
    const data = output.contracts[filename][name].evm;
    const bytecode = data.deployedBytecode.object;
    const common = new common_1.Common({ chain: 'mainnet' });
    const eei = new eei_1.ViewOnlyEEI(common, 'https://eth.llamarpc.com');
    const evm = new evm_1.EVM({ common, eei });
    const bytes = Buffer.from(bytecode, 'hex');
    const selector = Buffer.from(new sha3_1.Keccak(256).update(`${func}()`).digest('hex').slice(0, 8), 'hex');
    const result = await evm.runCode({
        code: bytes,
        data: selector,
        address: util_1.Address.fromString(address),
        gasLimit: BigInt(1000000),
    });
    console.log(result.returnValue);
})();
