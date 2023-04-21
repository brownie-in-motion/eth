hljs.highlightAll()

document.querySelector('textarea').textContent = [
    '(uint256) {',
    '    return 1;',
    '}',
].join('\n')

const query = async (data) => {
    const response = await fetch('/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    return await response.text()
}

const button = document.querySelector('button')
const form = document.querySelector('form')
form.addEventListener('submit', async (e) => {
    e.preventDefault()
    button.disabled = true
    document.querySelector('.output').textContent = 'Loading...'
    const data = new FormData(form)
    const result = await query({
        file: data.get('file'),
        contract: data.get('contract'),
        address: data.get('address'),
        patch: document.querySelector('textarea').value,
    })
    document.querySelector('.output').textContent = result
    button.disabled = false
})
