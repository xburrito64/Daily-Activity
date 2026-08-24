# App icon

Put the app's icon in this folder as:

```
icon.ico
```

That one file covers everything: the window, the taskbar, the Start menu
entry, the desktop shortcut and the installer. Nothing to configure — the
build picks it up by filename.

Until it exists the app uses the default Electron icon, which is why it
currently looks like a generic app.

## Format

**Windows `.ico`.** Not `.png` renamed to `.ico` — that fails the build with
a confusing message. A real `.ico` is a container holding several sizes at
once, and Windows picks whichever it needs.

It should contain these layers:

```
16  24  32  48  64  128  256
```

**256×256 is required** — the build refuses anything smaller as the largest
layer. The rest are optional but worth having: without a 16 and a 32, Windows
scales the 256 down for the taskbar and it comes out blurry.

## Making one

If you have a square PNG at 1024×1024 or so, any of these will convert it:

- <https://icoconvert.com> or <https://convertio.co/png-ico/> — tick the box
  for multiple sizes if offered
- GIMP: open the PNG, *Image → Scale* to each size on its own layer, then
  *File → Export As* `icon.ico`
- ImageMagick: `magick icon.png -define icon:auto-resize=256,128,64,48,32,24,16 icon.ico`

## Design notes

- **Square**, with the artwork centred and a little breathing room at the
  edges — Windows crops shortcuts slightly.
- **Transparent background** unless you want a visible square tile.
- It gets shown at **16 pixels** in the taskbar. Whatever it is has to survive
  that, so favour one bold shape over anything detailed.
- It sits on both light and dark Windows themes, so avoid something that only
  reads against one of them.

## After adding it

```bash
npm run package
```

The window icon updates on the next `npm run app` too.
