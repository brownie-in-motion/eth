import { Common } from '@ethereumjs/common'
import { EVM } from '@ethereumjs/evm'
import { Address } from '@ethereumjs/util'
import { ViewOnlyEEI } from './eei'
import { inject } from './inject'

// example: getting the first storage slot of WETH
// ignore unused
const eeiExample = async () => {
    const common = new Common({ chain: 'mainnet' })
    const eei = new ViewOnlyEEI(common, 'https://eth.llamarpc.com')
    const evm = new EVM({ common, eei })

    const code = Buffer.from(
        [
            '60',
            '00', // PUSH1 0
            '54', // SLOAD
            '60',
            '00', // PUSH1 0
            '52', // MSTORE
            '60',
            '20', // PUSH1 32
            '60',
            '00', // PUSH1 0
            'f3', // RETURN
        ].join(''),
        'hex'
    )

    const result = await evm.runCode({
        code,
        address: Address.fromString(
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        ),
        gasLimit: BigInt(1000000),
    })

    console.log(Buffer.from(result.returnValue.subarray(0, 32)).toString())
}

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
    `

    const { code, name } = inject(source, `
        (uint256) {
            uint z = 1 + 2;
            return z;
        }
    `, 'C')

    console.log(code)
    console.log(name)
}

void eeiExample;
void injectExample;
