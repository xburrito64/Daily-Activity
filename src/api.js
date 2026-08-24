async function request(url, options) {
  const res = await fetch(url, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status })
  return body
}

export const getTags = () => request('/api/tags')
export const getDay = (date) => request(`/api/day/${date}`)

export const putDay = (date, entries) =>
  request(`/api/day/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  })

export const getRange = (from, to) => request(`/api/range?from=${from}&to=${to}`)
