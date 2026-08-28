# Daily Documentation

A personal day tracker. One horizontal bar per day, 00:00 to 24:00. Pick a tag,
drag across the bar, and that stretch of time is logged. Runs locally, no
accounts, no cloud.

Days are stored in an Obsidian vault as one note per day, with the log kept in
a fenced code block so the rest of the note stays usable for normal writing:

````markdown
```daily-log
[{"tag":"sleep","start":"00:00","end":"08:15"},
 {"tag":"game","start":"09:20","end":"16:30","note":"HZD, finished the frozen wilds"}]
```
````

Everything outside that block is left byte-for-byte alone. Times are `HH:MM`
on 15-minute marks. If the JSON is hand-edited into something unparseable the
app says so and refuses to write over it.

## Running it

As a desktop app — its own window, no console, no browser:

```bash
npm run app
```

To build an installer instead (lands in `release/`):

```bash
npm run package
```

For development, with hot reload in a browser tab:

```bash
npm install
npm start
```

Then open http://localhost:5273. Only run one copy of the dev server at a
time — if it says the app is already running:

```bash
npm run stop
```

## Setup

**The installed app keeps its settings in `%APPDATA%/Daily Documentation/`**,
not in the project folder, so they survive reinstalling. Both `config.json`
and `tags.json` live there, copied from the project versions the first time it
runs. The app's menu has *Open settings folder*.

In development the project's own `config.json` and `tags.json` are used.

Copy `config.example.json` to `config.json` and point it at your daily notes
folder. Use forward slashes:

```json
{
  "vaultDailyDir": "C:/Vaults/YourVault/Daily",
  "port": 5274,
  "rawgKey": ""
}
```

`rawgKey` is only for naming games — see below. Leave it empty and everything
else works exactly as before; the search box says what is missing if you open
it. A setting added by a later version is filled into the installed copy on
next launch, so there is always a line to put it on.

Tags live in `tags.json` — name, colour and icon. Edit and refresh; no restart
needed.

Fonts go in `public/fonts/`, the app icon in `build/`, and images to replace
the tag emoji in `tag-icons/`. Each of those folders has a README explaining
the format and naming.

## Using it

- **Day view** — one full-size bar per day, endlessly scrollable. Scroll up for
  the past, down into the future.
- **Overview** — the same days compressed, read-only, for spotting patterns,
  with totals per tag for whatever is on screen beside it.
- **ctrl+scroll** resizes the rows. Each view remembers its own size.
- Click a block for its note, drag its edges to adjust the times, or use the
  red button to clear a whole day.
- Blocks may overlap: paint one over another and they share the bar's height
  for the stretch they have in common.

### Games

A **Game** block can say which game. Open its note and a search box is there;
type a name, pick it, and the block takes the game's name and its cover art in
place of the tag's own.

The name is written into the note as plain text, so the day still reads
sensibly in Obsidian with nothing installed. The cover is *copied* into
`<your daily folder>/covers/` rather than linked, so it keeps working offline
and the vault stays self-contained. One file per game, however many days
mention it.

It takes two databases, because neither does both jobs. RAWG is the search:
nine hundred thousand games including everything that never came to a PC. It
has no cover art at all — what it has is key art, the wide picture across the
top of a store page. The cover itself comes from Steam, which has one for
every game it sells and asks for no key. A game Steam has never sold gets its
name and no picture.

Opening a named Game block shows a card beside the note: the cover, what the
game is, and how long has gone into it across every day in the vault — not
just that session.

What a game *is* — its platforms, its genres, its year — is kept once per game
in `covers/games.json` rather than on every entry that mentions it. A day is a
record of what happened, and "Action, Platformer, PC" is not something that
happened; it would be the same forty lines of it in a year of playing one
game, in the file you actually read.

The platforms are the ones a game is **sold** on, which is not quite the same
as the one you played it on — nothing in either database knows that.

Genres start as the database's, which are coarse — there is no "FPS", only
"Action" — so they are yours to change. Click the `+` to add one, the `x` to
drop one, up to six per game. Once you have edited them nothing puts the
database's back, including picking the same game again.

Two Game blocks only merge into one when they are the same game — finishing
one and starting another is two things that happened.

The lookup needs a free key from [rawg.io/apikey](https://rawg.io/apikey) in
`rawgKey`. Nothing else in the app touches the network.

## Layout

```
electron/  desktop wrapper; runs the server in-process
server/    Express API; reads and writes the fenced block
src/       React frontend
src/styles/tokens.css   all colours, spacing and type sizes
```

```bash
npm test
```

covers the fence read/write and the block layout logic.
