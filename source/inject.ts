import { parse } from '@solidity-parser/parser'
import {
    BaseASTNode,
    ContractDefinition,
} from '@solidity-parser/parser/dist/src/ast-types'
import { randomBytes } from 'crypto'

const isNode = (node: any) => node && typeof node.type === 'string'

const walk = (root: BaseASTNode, callback: (node: BaseASTNode) => boolean) => {
    const stack = [root]
    while (stack.length > 0) {
        const current = stack.pop()!

        if (Array.isArray(current)) {
            for (const element of current) stack.push(element)
            continue
        }

        if (!isNode(current)) continue
        if (!callback(current)) continue

        const values = Object.values(current)
        for (const value of values) stack.push(value)
    }
}

const getContracts = (root: BaseASTNode): ContractDefinition[] => {
    const output: ContractDefinition[] = []
    walk(root, (node) => {
        if (node.type === 'ContractDefinition') {
            output.push(node as ContractDefinition)
            return false
        }
        return true
    })
    return output
}

export const inject = (
    code: string,
    func: string,
    contract: string
): {
    code: string
    name: string
} => {
    const ast = parse(code, { range: true })
    const contracts = getContracts(ast)

    const target = contracts.find((c) => c.name === contract)
    if (!target) throw new Error(`Could not find contract ${contract}`)

    // prevent collisions
    const name = `__injected_${randomBytes(8).toString('hex')}`
    const created = `function ${name}() external view returns ${func}`

    const root = parse(created)

    if (
        root.children.length !== 1 ||
        root.children[0].type !== 'FunctionDefinition'
    ) {
        throw new Error('Invalid function')
    }

    // assumption: end - 1 is right before the closing brace
    const [_start, end] = target.range!
    const patched = code.slice(0, end - 1) + created + code.slice(end - 1)

    // sanity check for syntax
    parse(patched)

    return { code: patched, name }
}
