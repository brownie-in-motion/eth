const form = document.querySelector('form')
const button = document.querySelector('input[type="submit"]')
const output = document.querySelector('.output')
form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(form)

    const params = new URLSearchParams()
    params.append('address', formData.get('address'))

    button.disabled = true
    output.textContent = 'Loading...'

    const result = await fetch(`/exists?${params.toString()}`)

    if (result.status === 200) {
        location = `/address/${formData.get('address')}`
    } else {
        button.disabled = false
        const data = await result.text()
        output.textContent = data
    }
})
