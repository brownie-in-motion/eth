import { execute } from './execute'

type Example = {
    address: string
    name: string
    patch: string
    contract?: string
}

const examples: Example[] = [
    // basic example: getting data out of contract
    {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        name: 'WETH9',
        patch: `
            (uint256) {
                return bytes(name).length;
            }
        `,
    },

    // see nft's private current id
    {
        address: '0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03',
        name: 'NounsToken',
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
        name: 'G_GAME',
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
        name: 'TokenBank',
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
        name: 'Private_Bank',
        patch: `
            (address) {
                return address(TransferLog);
            }
        `,
    }
]

void (async () => {
    const { address, name, patch, contract } = examples[0]
    const result = await execute(address, name, patch, contract)
    console.log(result.toString('hex'))
})()
