# Sudoku

Browser sudoku, no accounts and no ads. Play it here: https://yoonzky.github.io/sudoku/

Single html file, no dependencies. Games, settings and statistics live in localStorage.

## Features

- difficulty graded by technique, not by clue count — a solver checks every puzzle,
  so Easy yields to singles and Expert needs hidden pairs and X-wing
- draft mode: pencil a trial digit in dashes, notes underneath survive, mistakes are not counted
- digit pad right at the cell (double or right click)
- up to ten unfinished games at once, each with its own timer
- notes, auto-candidates, hint, undo/redo, mistake limit — all optional
- full keyboard control (1–9, Shift for notes, Alt for draft, arrows to move)
- light and dark theme, Russian and English
- works offline, installable to the home screen on iOS and Android

## Run locally

Just open `index.html` in a browser. The service worker (offline cache) only runs over http/https, not from `file://`.
Bump `CACHE` in `sw.js` on every release so the old cache is dropped.

`Sudoku.html` and `index.html` are the same file: the first is for opening from the vault, the second is what GitHub Pages serves.

## License

MIT © [yoonzky](https://github.com/yoonzky)
