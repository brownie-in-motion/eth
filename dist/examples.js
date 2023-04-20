"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@ethereumjs/common");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
const eei_1 = require("./eei");
const inject_1 = require("./inject");
// example: getting the first storage slot of WETH
// ignore unused
const eeiExample = async () => {
    const common = new common_1.Common({ chain: 'mainnet' });
    const eei = new eei_1.ViewOnlyEEI(common, 'https://eth.llamarpc.com');
    const evm = new evm_1.EVM({ common, eei });
    const code = Buffer.from([
        '60',
        '00',
        '54',
        '60',
        '00',
        '52',
        '60',
        '20',
        '60',
        '00',
        'f3', // RETURN
    ].join(''), 'hex');
    const result = await evm.runCode({
        code,
        address: util_1.Address.fromString('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
        gasLimit: BigInt(1000000),
    });
    console.log(Buffer.from(result.returnValue.subarray(0, 32)).toString());
};
const injectExample = async () => {
    const source = `
        contract C {
            function f() public {
                uint x = 1;
                uint y = 2;
                uint z = x + y;
            }
        }

        contract D {
            function g() public {
                uint x = 1;
                uint y = 2;
                uint z = x + y;
            }
        }
    `;
    const { code, name } = (0, inject_1.inject)(source, `
        (uint256) {
            uint z = 1 + 2;
            return z;
        }
    `, 'C');
    console.log(code);
    console.log(name);
};
void eeiExample;
void injectExample;
