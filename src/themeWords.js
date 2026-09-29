// What the app says, in the voice of the theme it is wearing.
//
// Only the handful of words that are about the diary rather than about how
// to use it: how many days there are, a day with nothing on it, taking a
// day back. Instructions stay plain in every theme — a shortcut explained in
// sea shanty is a shortcut nobody can find.

const WORDS = {
  starlit: {
    recorded: (n) => (n === 1 ? 'one day recorded' : `${n} days recorded`),
    emptyDay: 'nothing has happened here yet',
    blank: 'unwritten',
    wipe: 'Unwrite',
    wipeConfirm: 'Unwrite?',
  },
  petalfall: {
    recorded: (n) => (n === 1 ? 'one day in bloom' : `${n} days in bloom`),
    emptyDay: 'still in bud — nothing here yet',
    blank: 'in bud',
    wipe: 'Let it fall',
    wipeConfirm: 'Let it all fall?',
  },
  hearthfire: {
    recorded: (n) => (n === 1 ? 'one day kindled' : `${n} days kindled`),
    emptyDay: 'cold hearth — nothing kindled here yet',
    blank: 'unlit',
    wipe: 'Douse',
    wipeConfirm: 'Douse it?',
  },
  nightshift: {
    recorded: (n) => (n === 1 ? '1 day on disk' : `${n} days on disk`),
    emptyDay: 'no entries — awaiting input',
    blank: '0 bytes',
    wipe: 'rm day',
    wipeConfirm: 'rm day? [y/N]',
  },
  tidewater: {
    recorded: (n) => (n === 1 ? 'one day charted' : `${n} days charted`),
    emptyDay: 'calm water — nothing charted here yet',
    blank: 'uncharted',
    wipe: 'Wash away',
    wipeConfirm: 'Wash it away?',
  },
}

/** The words for a theme; anything it has none of is said the usual way. */
export const wordsFor = (theme) => ({ ...WORDS.starlit, ...(WORDS[theme] ?? {}) })
