# Tag icons

Drop an image in this folder and the matching tag uses it instead of its
emoji. Tags without an image here keep their emoji, so you can replace them
one at a time — nothing breaks in between.

## Naming

**The filename must be the tag's `id`, exactly as written in `tags.json`.**
Not its display name. Ids are lowercase and use hyphens:

| Tag              | id              | File to add          |
| ---------------- | --------------- | -------------------- |
| Sleep            | `sleep`         | `sleep.svg`          |
| Walk with Coco   | `walk-coco`     | `walk-coco.svg`      |
| Vibe Coding      | `vibe-coding`   | `vibe-coding.svg`    |
| DGG              | `dgg`           | `dgg.svg`            |
| Anything Else?   | `anything-else` | `anything-else.svg`  |

Current ids, ready to copy:

```
sleep  game  shower  smoke  reading  walk  walk-coco  anime
youtube  dgg  music  food  cleaning  vibe-coding  documenting
anything-else
```

A typo in the name isn't an error — the tag just quietly keeps its emoji. If
an icon doesn't show up, check the spelling against `tags.json` first.

## Format

**`.svg` is best.** It stays sharp at any size, and the icon is drawn small
in the bar but large on the chips.

Also accepted, in the order they're looked for:
`.svg`, `.png`, `.webp`, `.gif`, `.jpg`, `.jpeg`. If you somehow have both
`sleep.svg` and `sleep.png`, the `.svg` wins.

**Animated GIFs play**, and so do animated WebP files — wherever that icon is
drawn, so on the chip, the block and the note at once. Nothing to switch on.
A GIF can only make a pixel fully transparent or not at all, so anything with
soft edges shows a fringe of whatever colour it was saved against; animated
WebP has proper transparency and is the better choice if the shape isn't
blocky.

## Size and shape

- **Square.** Nothing is stretched — a wider image is fitted inside a square
  and the leftover space stays empty, so a 64×32 picture draws at 16×8 and
  ends up half the size it could have been.
- **SVG:** any size, as long as the `viewBox` is square. `0 0 24 24` is typical.
- **PNG and friends:** **64×64 or larger.** It's displayed at 16 pixels, but
  bigger source images stay crisp on high-resolution screens. Below 32×32 will
  look rough.
- **Transparent background.** A white or black square will look like a sticker
  glued onto the coloured block.

## How it will look

The same image is used in three places, so it needs to work in all of them:

- on the coloured block in the bar, small — around 16 pixels
- on the tag chip under each day, same size
- in the note panel when a block is open

Blocks are mid-dark colours and chips are a tinted version of the same colour,
so **a light or white icon reads well in both**. A dark icon will disappear
against the darker tags like Sleep.

Simple, solid shapes beat fine detail. At 16 pixels, thin lines vanish.

## After adding one

Refresh the app — no restart needed.

If you are running the **installed** app, this folder is the one inside
`%APPDATA%\Daily Documentation\`, not the one in the project. The app's menu
has *Open settings folder*, which takes you straight there.
