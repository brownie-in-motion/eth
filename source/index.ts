import { readdirSync, readFileSync } from 'fs'

import express from 'express'
import handlebars from 'handlebars'

import { contract, execute } from './execute'

const templates = new Map()
readdirSync('templates').forEach((file) => {
    const template = handlebars.compile(
        readFileSync(`templates/${file}`, 'utf8')
    )
    const name = file.split('.')[0]
    handlebars.registerPartial(name, template)
    templates.set(name, template)
})

const app = express()

app.use(express.static('public', { extensions: ['html'] }))
app.use(express.json())

app.get('/address/:address', async (req, res) => {
    const address = req.params.address
    const { name, contracts } = await contract(address)
    res.send(
        templates.get('contract')({
            address,
            name,
            contracts: [...contracts.entries()].map(([file, { code }]) => ({
                file,
                code,
            })),
        })
    )
})

app.post('/run', async (req, res) => {
    const { address, file, patch, contract: nested } = req.body
    const result = await execute(address, file, patch, nested)
    res.send(result.toString('hex'))
})

app.listen(3000)
