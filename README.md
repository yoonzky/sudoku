# Sudoku

Browser sudoku in seventeen shapes, no accounts and no ads. Play it here: https://yoonzky.github.io/sudoku/

Plain HTML, CSS and JavaScript — no build step, no dependencies. Games, settings and statistics live in localStorage.

## Modes

| Group | Modes |
|---|---|
| Plain board | Classic · X-Sudoku · Even-Odd · Windoku · Asterisk · Mosaic |
| Other sizes | 10×10 (5×2 regions) · 12×12 (4×3 regions) |
| Linked boards | Double · Wing · Butterfly · Samurai |
| Extra rules | Killer · Dots (Kropki) · Suguru · Numerator · Kakuro |

Every mode has four levels and its own statistics. The home screen shows a thumbnail of each
board, so a mode can be picked by its shape. **Random mode** draws one of the modes you ticked
and starts it at the level you choose.

## Features

- difficulty set by two things: how many clues stay on the board, and which techniques the
  puzzle needs — a solver grades every deal, so Easy yields to singles and Expert asks for
  hidden pairs, triples and X-wing
- every puzzle is generated with exactly one solution, whatever the mode
- draft mode: pencil a trial digit in dashes, notes underneath survive, mistakes are not counted
- digit pad right at the cell (double or right click); in Numerator it waits for the second
  digit, since the numbers run to 81
- up to ten unfinished games at once, each with its own timer; several can be picked and dropped together
- notes, auto-candidates, hint, undo/redo, mistake limit — all optional
- full keyboard control (1–9, A/B/C for 10–12, Shift for notes, Alt for draft, arrows to move)
- light and dark theme, Russian and English
- on a phone: picking a mode opens a sheet with its rules and the four levels; boards wider than
  the screen (Samurai, Wing, Double) open in a window you drag around, with a button to fit them
  back; a long press on a cell brings up the pad — digit, note, draft, erase
- works offline, installable to the home screen on iOS and Android

## Layout

```
index.html            markup and the load order
Sudoku.html           the same file, kept for opening straight from disk
css/base.css          palette, type, page frame, buttons, toast
css/home.css          home screen: continue, mode grid, mode card
css/game.css          board, rule marks, controls, keypad, result panel
css/modals.css        settings, statistics, rules, confirmations
css/mobile.css        phone: home sheet, board window, keypad, landscape
js/engine/core.js     cells, groups, solver, clue digging
js/engine/grade.js    grading by technique, level tuning
js/engine/modes.js    the mode table and puzzle generation
js/engine/numerator.js  the 1..81 chain and its own solver
js/engine/kakuro.js   pattern, sums, single solution
js/engine/worker.js   generation off the main thread
js/app/i18n.js        dictionaries, mode names and rules
js/app/store.js       localStorage: settings, games, record of wins
js/app/ui.js          theme, cell pad, settings, statistics
js/app/preview.js     board thumbnails
js/app/board.js       building and drawing a board of any shape
js/app/game.js        moves, undo, hints, win, timer
js/app/home.js        home screen and the random draw
js/app/main.js        events, keyboard, start-up
```

One model describes every mode: cells with coordinates, groups that hold each digit once,
pairs that must differ, summed areas, dots, and a mask of allowed digits. Solver, grading and
drawing are shared, so a new mode is one entry in `js/engine/modes.js`. Numerator falls outside
the model — it is about connectivity rather than groups — and lives in its own file.

Everything random in a deal — Suguru regions, Killer cages, dots, parity, the Kakuro pattern —
is stored with the game in `ex`, so a reloaded page rebuilds the exact same board.

## Run locally

Open `index.html` in a browser. Over `file://` the service worker and the generator worker stay
off, and generation runs on the main thread; everything else works.

To serve it over http instead:

```
python3 -m http.server 8000
```

Bump `CACHE` in `sw.js` on every release so the old cache is dropped.

## License

MIT © [yoonzky](https://github.com/yoonzky)
