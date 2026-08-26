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

/**
 * Games matching what has been typed. `signal` abandons a search the moment
 * a newer one starts, so the answer to a word you have finished typing can
 * never land on top of the answer to the word you are typing now.
 */
export const searchGames = (query, signal) =>
  request(`/api/games?q=${encodeURIComponent(query)}`, { signal })

/** Copy a game's cover into the vault. Answers with the file it became. */
export const keepCover = (game) =>
  request('/api/games/cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: game.id, name: game.name, image: game.image }),
  })

/** Where a kept cover is served from. */
export const coverUrl = (file) => `/api/covers/${encodeURIComponent(file)}`
