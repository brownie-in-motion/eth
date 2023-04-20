"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const express_1 = __importDefault(require("express"));
const handlebars_1 = __importDefault(require("handlebars"));
const execute_1 = require("./execute");
const templates = new Map();
(0, fs_1.readdirSync)('templates').forEach((file) => {
    const template = handlebars_1.default.compile((0, fs_1.readFileSync)(`templates/${file}`, 'utf8'));
    const name = file.split('.')[0];
    handlebars_1.default.registerPartial(name, template);
    templates.set(name, template);
});
const app = (0, express_1.default)();
app.use(express_1.default.static('public', { extensions: ['html'] }));
app.use(express_1.default.json());
app.get('/address/:address', async (req, res) => {
    const address = req.params.address;
    const { name, contracts } = await (0, execute_1.contract)(address);
    res.send(templates.get('contract')({
        address,
        name,
        contracts: [...contracts.entries()].map(([file, { code }]) => ({
            file,
            code,
        })),
    }));
});
app.post('/run', async (req, res) => {
    const { address, file, patch, contract: nested } = req.body;
    const result = await (0, execute_1.execute)(address, file, patch, nested);
    res.send(result.toString('hex'));
});
app.listen(3000);
