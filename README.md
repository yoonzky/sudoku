# Sudoku

Eighteen kinds of sudoku in the browser. No accounts, no ads, no build step.

**[Play →](https://yoonzky.github.io/sudoku/)**

Plain HTML, CSS and JavaScript. Games, settings and statistics live in localStorage.

## Modes

| Group | Modes |
|---|---|
| **Plain board** | Classic · X-Sudoku · Even-Odd · Windoku · Asterisk · Mosaic |
| **Other sizes** | 10×10 · 12×12 |
| **Linked boards** | Double · Wing · Butterfly · Samurai |
| **Extra rules** | Killer · Dots · Suguru · Numerator · Kakuro · Tokkidoku |

Four levels each, own statistics each. **Random mode** deals one of the modes you tick.

## What it does

- **Levels mean something.** A solver grades every deal: Easy yields to singles, Hard wants
  locked candidates, Expert aims at hidden triples and X-wing.
- **One solution, always.** A deal the grader cannot crack by reasoning gets clues back until
  it can.
- **Three ways to fill a cell** — the digit, corner marks, centre marks. `Z` `X` `C` pick one,
  space steps through them, shift or ⌘ borrows one while held.
- **Mouse:** drag across cells to pick a run, ⌘-click to pick cells apart; a digit pad opens
  at the cell on double or right click.
- **Phone:** the mode opens as a sheet, wide boards (Samurai, Wing, Double) open in a window
  you drag, the keypad sits under the board.
- **Eight unfinished games** at once, each with its own timer.
- Hints, auto-candidates, undo/redo, mistake limit — all optional.
- Two themes, Russian and English. The three typefaces ship with the site.

## How it is built

One model covers every mode: cells with coordinates, groups that hold each digit once, pairs
that must differ, summed areas, dots, a mask of allowed digits. Solver, grading and drawing are
shared, so a new mode is one entry in `js/engine/modes.js`. Numerator is about connectivity
rather than groups and lives apart.

Everything random in a deal — Suguru regions, Killer cages, dots, parity, the Kakuro pattern —
is saved with the game in `ex`, so a reloaded page rebuilds the same board.

```
index.html          markup and the load order
css/                base · home · game · modals · mobile
js/engine/          core · grade · modes · numerator · kakuro · tokki · worker
js/app/             i18n · store · ui · preview · board · game · home · main
fonts/ icons/       Tenor Sans, Onest, Lora · site icons
```

## Run it locally

Open `index.html` in a browser — over `file://` generation runs on the main thread and
everything else works. To serve it over http:

```
python3 -m http.server 8000
```

## License

MIT © [yoonzky](https://github.com/yoonzky)
