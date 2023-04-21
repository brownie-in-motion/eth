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
app.use(express.static('node_modules/highlight.js/lib'))
app.use(express.json())

app.get('/address/:address', async (req, res) => {
    const address = req.params.address
    try {
        const { name, contracts } = await contract(address)
        const data = [...contracts.entries()].map(([file, { code }]) => ({
            file,
            code,
        }))
        res.send(
            templates.get('contract')({
                address,
                name,
                contracts: data,
            })
        )
    } catch {
        res.redirect('/')
    }
})

app.get('/exists', async (req, res) => {
    const { address } = req.query
    if (!address) return res.status(400).send('No address provided.')
    try {
        await contract((address ?? '').toString())
    } catch (e: any) {
        return res.status(400).send('Contract not found.')
    }
    res.send('Contract exists!')
})

app.post('/run', async (req, res) => {
    const { address, file, patch, contract: nested } = req.body
    try {
        const result = await execute(address, file, patch, nested)
        res.send(result.toString('hex'))
    } catch (e: any) {
        res.status(500).send(e.message ?? 'There was an error.')
    }
})

app.listen(3000, () => console.log('listening on port 3000...'))
