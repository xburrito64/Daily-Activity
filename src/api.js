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

/**
 * Take a game: its cover into the vault, and what it is written down beside
 * the covers. Answers with the file the cover became.
 */
export const attachGame = (game) =>
  request('/api/games/attach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(game),
  })

/** How long has gone into each game, across every day in the vault. */
export const getPlayed = () => request('/api/games/played')

/** Where a kept cover is served from. */
export const coverUrl = (file) => `/api/covers/${encodeURIComponent(file)}`
