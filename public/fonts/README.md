# Fonts

Drop the Crimson Pro `.woff2` files straight into this folder. Nothing else to
configure — the app already expects these exact filenames:

    CrimsonPro-Regular.woff2     (weight 400)  <- needed
    CrimsonPro-SemiBold.woff2    (weight 600)  <- needed
    CrimsonPro-Bold.woff2        (weight 700)  <- optional, see below

Only files that are actually referenced get requested — see
`src/styles/fonts.css`. Adding Bold or switching to the variable version
means uncommenting one block in that file; it says which.

After dropping a font in, reload with **Ctrl+Shift+R**. A plain refresh can
reuse a cached miss from before the file existed.

Where to get them: https://fonts.google.com/specimen/Crimson+Pro
Download, unzip, and if you only have `.ttf` files convert them at
https://transfonter.org (choose woff2) — `.ttf` works too, the files are just
several times larger.

## Regular + SemiBold, or Regular + Bold?

The app currently pairs Regular (400) with SemiBold (600).

To try Bold instead:

1. Put CrimsonPro-Bold.woff2 in this folder.
2. Uncomment the 700 block in `src/styles/fonts.css`.
3. In `src/styles/tokens.css` set `--w-medium: 700;` and `--w-bold: 700;`
