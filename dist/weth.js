"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@ethereumjs/common");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
const eei_1 = require("./eei");
// example: getting the first storage slot of WETH
const common = new common_1.Common({ chain: 'mainnet' });
const eei = new eei_1.ViewOnlyEEI(common, 'https://eth.llamarpc.com');
const evm = new evm_1.EVM({ common, eei });
void (async () => {
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
})();
