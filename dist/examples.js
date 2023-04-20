"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@ethereumjs/common");
const evm_1 = require("@ethereumjs/evm");
const util_1 = require("@ethereumjs/util");
const eei_1 = require("./eei");
const inject_1 = require("./inject");
const execute_1 = require("./execute");
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
const examples = [
    // basic example: getting data out of contract
    {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        file: 'WETH9.sol',
        patch: `
            (uint256) {
                return bytes(name).length;
            }
        `,
    },
    // see nft's private current id
    {
        address: '0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03',
        file: 'NounsToken.sol',
        patch: `
            (uint256) {
                return _currentNounId;
            }
        `,
    },
    // honeypot:
    // https://etherscan.io/address/0x3CAF97B4D97276d75185aaF1DCf3A2A8755AFe27
    {
        address: '0x3CAF97B4D97276d75185aaF1DCf3A2A8755AFe27',
        file: 'G_GAME.sol',
        // made to look like the answer is 'TroublE'
        // a somewhat hidden transaction actually changes it
        patch: `
            (bool) {
                return responseHash == keccak256("TroublE");
            }
        `
    },
    // honeypot:
    // https://etherscan.io/address/0x39CFD754c85023648Bf003beA2Dd498c5612AbFA
    {
        address: '0x39CFD754c85023648Bf003beA2Dd498c5612AbFA',
        file: 'TokenBank.sol',
        patch: `
            (address) {
                return owner;
            }
        `,
        // if we patch it in ownable we get
        // 000000000000000000000000e68082350257d960955bd982e7c72c44505c0cc7
        // if we patch it in tokenbank (comment this out) we get
        // 000000000000000000000000b366ee6007d655b665d698d86f406622c15fda12
        // this means that the ability to reinitialize is a *fake*
        // vulnerability
        contract: 'Ownable',
    },
    // honeypot:
    // https://etherscan.io/address/0xb5e1b1ee15c6fa0e48fce100125569d430f1bd12
    {
        address: '0xb5e1b1ee15c6fa0e48fce100125569d430f1bd12',
        file: 'Private_Bank.sol',
        patch: `
            (address) {
                return address(TransferLog);
            }
        `,
    }
];
void (async () => {
    const { address, file, patch, contract } = examples[2];
    const result = await (0, execute_1.execute)(address, file, patch, contract);
    console.log(result.toString('hex'));
})();
