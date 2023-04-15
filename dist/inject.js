"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
const parser_1 = require("@solidity-parser/parser");
const crypto_1 = require("crypto");
const isNode = (node) => node && typeof node.type === 'string';
const walk = (root, callback) => {
    const stack = [root];
    while (stack.length > 0) {
        const current = stack.pop();
        if (Array.isArray(current)) {
            for (const element of current)
                stack.push(element);
            continue;
        }
        if (!isNode(current))
            continue;
        if (!callback(current))
            continue;
        const values = Object.values(current);
        for (const value of values)
            stack.push(value);
    }
};
const getContracts = (root) => {
    const output = [];
    walk(root, (node) => {
        if (node.type === 'ContractDefinition') {
            output.push(node);
            return false;
        }
        return true;
    });
    return output;
};
const inject = (code, func, contract) => {
    const ast = (0, parser_1.parse)(code, { range: true });
    const contracts = getContracts(ast);
    const target = contracts.find((c) => c.name === contract);
    if (!target)
        throw new Error(`Could not find contract ${contract}`);
    // prevent collisions
    const name = `__injected_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
    const created = `function ${name}() external view returns ${func}`;
    const root = (0, parser_1.parse)(created);
    if (root.children.length !== 1 ||
        root.children[0].type !== 'FunctionDefinition') {
        throw new Error('Invalid function');
    }
    // assumption: end - 1 is right before the closing brace
    const [_start, end] = target.range;
    const patched = code.slice(0, end - 1) + created + code.slice(end - 1);
    // sanity check for syntax
    (0, parser_1.parse)(patched);
    return { code: patched, name };
};
exports.inject = inject;
