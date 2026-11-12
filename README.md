# Scrabby

A mobile-friendly crossword word-game solver. Tap 12 letters and get a **proven optimal arrangement**, using SOWPODS. Everything runs client side in JavaScript, with the search in a Web Worker to keep the interface responsive.

## Run

Requires Node.js 18 or newer. No npm dependencies; local development needs no build step.

```sh
cd ~/src/blue/scrabby
npm start
```

Open **http://localhost:5173** on your Mac. On your phone, connect to the same Wi-Fi and open the LAN URL printed by the server. Keep the Mac running; allow incoming connections if macOS asks. Use `PORT=8080 npm start` to change ports.

You can also serve these files from any static web host, including GitHub Pages. Serve over HTTP(S), not by opening `index.html` directly. The app has no server-side solver, accounts, API keys, analytics, or external runtime dependencies.

On HTTPS or localhost, a service worker caches the app and data for offline use after the first complete load. A plain HTTP LAN address works for solving but cannot install an offline service worker. Use a current Safari, Chrome, Firefox or Edge (gzip `DecompressionStream` and module workers are required). On mobile, use the browser’s **Add to Home Screen** option for convenient access.

## Build and deploy to Cloudflare Pages

```sh
npm run build
```

This recreates `dist/` with only the app's runtime files, compressed dictionary and shapes, and a Cloudflare `_headers` file. No dependency installation, bundling or data regeneration is needed. Deploy the contents of `dist/` to your static host.

For a [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/build-configuration/), use:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Leave blank (repository root) |

Alternatively, build locally and upload the `dist` folder through Cloudflare Pages Direct Upload. Commit `scripts/build.js`, `package.json` and `.gitignore`; `dist/` is generated and ignored by Git. The hosted app runs entirely in the browser; no Pages Functions or backend configuration is needed.

## Use

- Tap letter buttons 12 times; repeats are supported. The search starts automatically.
- Up to two of the 12 tiles can be blanks. Tap **? Blank tile**, or type `?` on a computer. A blank represents any letter and counts normally towards word length and the all-12 bonus. Blank tiles in the solution have a dashed border and a small `?`; the note underneath gives their chosen letters.
- Tap a selected tile to remove it, or choose **Clear all**.
- On a computer, type letters and use Backspace to remove the last tile.
- Tap a result word to highlight its position. Every distinct word placement counts, even when its spelling appears elsewhere.
- Tap **Reject “WORD” & try again** to exclude the main horizontal long word and solve the same rack again. Rejections accumulate for that rack and exclude those words everywhere in subsequent arrangements. The next result is optimal for the remaining allowed words. **Reset rejections** restores them and searches again; changing the rack also clears them. Rejections do not edit your word-list files and are cleared on page reload.
- **Stop search** (or Escape) keeps the best arrangement found so far. It is explicitly labelled unproven. Search again to finish proving the optimum.
- The last rack is saved in your browser, when local storage is available.

## Rules and exactness

Words read left to right and downwards. Every maximal horizontal or vertical run of two or more tiles must be in SOWPODS. All used tiles connect by edges. One-letter runs do not count as words. Unused letters are permitted, with the bonus awarded only when all 12 are used.

Two- and three-letter words must also appear in their respective editable allowed lists below. Each of up to two blanks can stand for any letter; a blank at a crossing represents the same letter in both words and spends just one tile. The solver proves the optimum for your allowed word lists, including blank substitutions.

A longest word always runs horizontally and is highlighted in the solution. When needed, the solver swaps rows and columns, preserving every word, blank and the optimal score. If several words tie for longest, a horizontal one is highlighted.

```
score = longest word length + number of word placements + (all 12 used ? 1 : 0)
```

The solver enumerates **every connected shape of 2–12 tiles**, normalised by translation and transposition. Transposition swaps across and down without reversing reading direction; reflection and rotation are not discarded because they can reverse words. There are 345,885 templates in total, including 253,014 of size 12. The maximum geometric score is 17, achieved by two templates.

Shapes are searched in descending score order. For each shape, a constraint search fills every horizontal/vertical word slot using rack-compatible dictionary words, respecting crossings and exact tile multiplicities. It chooses the slot with the fewest remaining candidates and uses positional word indexes. The first feasible shape is globally optimal. A valid longest-word baseline is returned immediately while the search continues. If all higher scores fail, that baseline is also proven optimal. A rack with no possible two-letter-or-longer word returns zero points and all letters unused.

Typical racks solve quickly, but this is exhaustive search and difficult racks can take longer on mobile. There is no time limit that silently turns an approximate result into an “optimal” one.

## Choose your two- and three-letter words

Edit the appropriate file, with one allowed word per line:

- **`data/two-letter-words.txt`** starts with all 124 two-letter SOWPODS words.
- **`data/three-letter-words.txt`** starts with all 1,292 three-letter SOWPODS words.

Delete any lines you do not want the solver to use. Blank lines and `#` comments are allowed. An empty list disables all words of that length. Each list only affects complete words of its own length: four-letter and longer words remain available, even if they contain a removed pair or triple.

You do **not** need to edit `data/sowpods.txt`, recompress the dictionary, or regenerate shapes for this. The app reads the allowed lists separately. Invalid or non-SOWPODS entries produce an error with the relevant filename and line number, including during a build.

- **Locally:** save either list and reload the page to load it into a fresh solver.
- **Cloudflare Pages:** commit and push the edited lists; your usual `npm run build` includes both in `dist/`. Reload the deployed app once the deployment finishes. The lists refresh when online and are cached for offline use.

Keep both word-list files in Git alongside the other source files. Restore a removed word by putting it back on its own line.

## Dictionary and data

The bundled traditional **267,751-word SOWPODS** list is from [Jessica McKellar’s Scrabble project](https://github.com/jesstess/Scrabble/blob/master/scrabble/sowpods.txt), downloaded 12 November 2026. It is not a claim to use the latest Collins tournament edition. SOWPODS contains obscure, archaic and potentially offensive entries. Dictionary rights remain with their respective owners; review the source and applicable rights before redistributing commercially.

`data/sowpods.txt` is the readable list; the browser loads `data/sowpods.txt.gz`. `data/shapes.bin.gz` is the generated shape catalogue. Initial compressed solver data is about 1.6 MB. No letters are sent to a remote solver.

Regenerate the shapes with Python 3 (takes around a minute on a recent computer):

```sh
python3 scripts/generate-shapes.py
python3 scripts/compress-data.py
```

The shape binary has variable-length records: tile count (one byte), score (one byte), then one byte per tile encoding `row * 16 + column`. Records are sorted by descending score.

## Verify

```sh
npm test
```

Tests cover the shape catalogue and scores, dictionary integrity, 17-point solutions with zero, one and two blanks, blank sharing at crossings, insufficient blanks, two- and three-letter filtering, repeated-letter constraints, a lower optimum, unused tiles, no-word racks, connectivity and invalid inputs. Result validation independently reconstructs the board and every word, including the exact physical tiles and blanks spent.
