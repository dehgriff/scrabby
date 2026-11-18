# Scrabby

A dark-themed, mobile-friendly crossword word game and solver. Draw 12 letters, build a crossword, and check it against SOWPODS—or reveal a **proven optimal arrangement**. Letter buttons become larger in landscape; on landscape phones the keyboard uses the full screen width. Everything runs client side in JavaScript, with dictionary checks and the solver in a Web Worker.

Inspired by the discontinued **Scrabble Speed** game (also known as Scrabble Speed Tower). Scrabby is an independent project and is not affiliated with or endorsed by the game's publishers.

## Run

Requires Node.js 18 or newer. No npm dependencies; local development needs no build step.

```sh
cd scrabby
npm start
```

Run these commands from the cloned repository. Open **http://localhost:5173** in a browser on the computer running the server. Set the `PORT` environment variable to change the default port of 5173.

You can also serve these files from any static web host, including GitHub Pages. Serve over HTTP(S), not by opening `index.html` directly. The app has no server-side solver, accounts, API keys, analytics, or external runtime dependencies.

On HTTPS or localhost, a service worker caches the app and data for offline use after the first complete load. Use a current Safari, Chrome, Firefox or Edge (gzip `DecompressionStream` and module workers are required). On mobile, open the deployed HTTPS site and use the browser’s **Add to Home Screen** option for convenient access.

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

Cloudflare Pages supports both public and private Git repositories. Changing only the repository's visibility should not require changing the existing Pages project, build settings or custom domain. Keep the Cloudflare Git integration authorized for the repository.

## Use

- Choose **Draw 12 letters** for a random rack, or expand **Choose letters manually** and tap 12 letter buttons. Repeats are supported. Then choose **Play** or **Solve**; drawing or entering letters does not reveal a solution automatically.
- Up to four of the 12 tiles can be blanks. Tap **?** at the right of the bottom QWERTY row, or type `?` on a computer. A blank represents any letter and counts normally towards word length and the all-12 bonus. Blank tiles in the solution have a dashed border and a small `?`; the note underneath gives their chosen letters.
- Tap a selected tile to remove it, or choose **Clear all**.
- On a computer, type letters and use Backspace to remove the last tile.
- The three sections are **Your letters**, **Your crossword**, and **Your best arrangement**. Play scrolls to the board; Solve reveals the solver's arrangement in the third section without changing the play board.
- Tap a solver result word to highlight its position. Every distinct word placement counts, even when its spelling appears elsewhere.
- Tap **Reject word** to exclude the highlighted main long word and solve the same rack again. Rejections accumulate for that rack and exclude those words everywhere in subsequent arrangements. The next result is optimal for the remaining allowed words. **Reset rejections** restores them and searches again; changing the rack also clears them. Rejections do not edit your word-list files and are cleared on page reload.
- **Reject + use common words** also switches to the common-word list for all words of four letters or more, keeping your two- and three-letter lists unchanged. The dictionary label shows which mode is active. Further rejections stay in common mode. **Use SOWPODS** switches back, retaining rejections; **Reset rejections** only resets exclusions. Each new rack (including an example) and page reload defaults to SOWPODS.
- **Stop search** (or Escape) keeps the best arrangement found so far. It is explicitly labelled unproven. Search again to finish proving the optimum.
- The last rack is saved in your browser, when local storage is available.

**Draw 12 letters** draws without replacement from a fresh 82-tile bag using the configured Scrabble Speed Tower distribution. Each click starts a new rack and resets the play board and solver. The counts live in `tile-bag.js`:

```text
A×7 B×2 C×2 D×3 E×10 F×2 G×2 H×2 I×7 K×1 L×3
M×2 N×5 O×6 P×2 R×5 S×3 T×5 U×3 V×2 W×2 Y×2 Blank×4
```

The bag contains 78 letter tiles and four blanks. J, Q, X and Z are absent from the bag and disabled in the manual picker, including direct keyboard entry. Blanks can still represent them. You can enter the other letters and up to four blanks manually.

## Play a crossword

1. Choose **Play** after drawing or entering 12 letters. All tiles start in the off-board tray. A 60-second countdown appears beside **Reset board**. At zero it turns red and automatically checks the current arrangement once; you can keep editing and checking afterwards. The timer follows elapsed time even when the tab is in the background. Only Play starts a fresh countdown; Reset board clears the tiles without changing the remaining time or restarting an expired timer. Changing the rack clears it, and Solve stops it.
2. Tap tray tiles in order to build a horizontal main word. Tiles leave empty slots behind, so the remaining tray letters stay in place for quick tapping. Returning a tile fills its original gap. Tapping a blank opens a QWERTY keyboard; choosing its letter appends it to the word.
3. Then start dragging to finish quick word entry. Drag any tile from the tray or board onto an empty grid cell. Drag back to the tray to remove a board tile. Occupied cells cannot be overwritten.
4. Alternatively, select a regular tile and tap an empty cell, or use **Return selected tile**. Focused board tiles can be moved with arrow keys or returned to the tray with Backspace/Delete. Tap a blank at any time to change its assigned letter; it can also be dragged like any other tile.
5. The **potential score** updates after each placement or blank-letter change. It counts every horizontal and vertical word run, even if the spelling is invalid. The all-tiles bonus requires 12 connected board tiles. Word chips remain unchecked until requested.
6. Choose **Check** to validate the arrangement against SOWPODS and the configured two- and three-letter lists. Common-word mode and solver rejections do not affect play checks. Invalid words and their tiles turn red. Disconnected tiles and unset blanks also prevent a successful check. Starting another edit clears the previous check's highlighting.
7. A valid check confirms the score. Keep arranging and check again to improve it, choose **Reset board** to return every tile to the tray and clear blank assignments, or choose **Solve** to compare with the best possible arrangement. The solver shows a spinner while searching, then reveals its completed result. Stopping a search still reveals the best arrangement found so far.

The board starts with at least seven columns and five rows, and grows to retain an empty cell on all sides of the current arrangement. The entire grid stays visible without internal scrolling: cells and letters shrink together as needed to fit the available width and board height, including after rotating the device. Unused tray tiles are permitted, but all board tiles must connect. The play arrangement is kept while comparing with the solver; changing the rack or reloading resets it. Only the rack is saved between visits.

Choose **Solve with my word** to optimise around your played word instead of searching freely. This third button becomes available for a complete longest horizontal word on the play board; if several tie, the word on the original entry row is preferred, then the uppermost/leftmost. Blanks must have assigned letters. The button's tooltip identifies the selected word. The solver rearranges the rack while keeping that spelling as a longest horizontal word, and proves the best score under that constraint. It uses SOWPODS and the editable short-word lists, and reports an error if the chosen word is not allowed. The play board is unchanged.

The result identifies the fixed main word. Reject buttons are hidden while a word is fixed, since rejecting it would contradict the constraint. Choose **Solve**, or use **Solve** in section one, to search freely. Switching between fixed and free searches clears previous solver rejections.

## Rules and exactness

Words read left to right and downwards. Every maximal horizontal or vertical run of two or more tiles must be in the active dictionary: SOWPODS for words of four or more letters, and the editable short-word lists for two- and three-letter words. All used tiles connect by edges. One-letter runs do not count as words. Unused letters are permitted, with the bonus awarded only when all 12 are used.

The two- and three-letter lists override SOWPODS for their respective word lengths, allowing custom entries such as IE. Each of up to four blanks can stand for any letter; a blank at a crossing represents the same letter in both words and spends just one tile. The solver proves the optimum for your allowed word lists, including blank substitutions.

A longest word always runs horizontally and is highlighted. The solver swaps rows and columns when needed, preserving every word, blank and the optimal score. If several words tie for longest, a horizontal one is highlighted.

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

Add any two- or three-letter words you want to allow, even if absent from SOWPODS, or delete lines you do not want to use. These files are authoritative for their respective word lengths in the solver, common-word mode and play checks. For example, adding `IE` to `data/two-letter-words.txt` allows IE throughout the app. Entries must contain exactly two or three A–Z letters; lowercase is accepted and duplicates are ignored. Blank lines and `#` comments are allowed. An empty list disables all words of that length. Each list only affects complete words of its own length: four-letter and longer words remain available, even if they contain a removed pair or triple.

You do **not** need to edit `data/sowpods.txt`, recompress the dictionary, or regenerate shapes for this. The app reads the allowed lists separately. Entries with the wrong length or non-letter characters produce an error with the relevant filename and line number, including during a build; membership in SOWPODS is not required for short words.

- **Locally:** save either list and reload the page to load it into a fresh solver.
- **Cloudflare Pages:** commit and push the edited lists; your usual `npm run build` includes both in `dist/`. Reload the deployed app once the deployment finishes. The lists refresh when online and are cached for offline use.

Keep both word-list files in Git alongside the other source files. Restore a removed word by putting it back on its own line.

## Dictionary and data

The bundled traditional **267,751-word SOWPODS** list is from [Jessica McKellar’s Scrabble project](https://github.com/jesstess/Scrabble/blob/master/scrabble/sowpods.txt), downloaded 12 November 2026. Credit goes to that project for providing the source file and to the original lexicon compilers. It is not the latest Collins tournament edition. SOWPODS contains obscure, archaic and potentially offensive entries.

The source repository carries the **MIT License**, copyright 2012–2013 Jessica McKellar. Its notice is preserved in [data/sowpods-source-LICENSE.txt](data/sowpods-source-LICENSE.txt) and included in builds. This records the source repository's license; it does not establish a separate license from the original SOWPODS lexicon owners. The common-word list contains selections from that same lexicon. The two- and three-letter allowed lists are based on SOWPODS and may include custom additions.

The optional common-word list, **`data/common-words.txt`**, contains **12,204 SOWPODS words of 4–12 letters** with English Zipf frequency >= 3.5 in **wordfreq 3.1.1** by Robyn Speer. That threshold corresponds to roughly 3 occurrences per million words. [wordfreq](https://github.com/rspeer/wordfreq) combines books, news, subtitles and other usage sources; its data reflects usage through about 2021. The SOWPODS intersection ensures that every common-mode word is still game-valid. Frequency is a proxy for familiarity: it removes entries such as DETENT, INHERE and RIBIER, while keeping FRIEND, GARDEN and LETTER, but it can omit familiar low-frequency words and retain some specialist terms.

The frequency-derived selection is distributed under **[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)**. Credit goes to **Robyn Speer** and the wordfreq data contributors, including Google Books Ngram Viewer, Wikipedia contributors, the Leeds Internet Corpus, ParaCrawl, OpenSubtitles/OPUS, and SUBTLEX authors Marc Brysbaert et al. The wordfreq software is Apache-2.0 licensed; Scrabby bundles the generated selection rather than the Python software.

Source credits, selection criteria and modifications are recorded in [data/common-words-info.txt](data/common-words-info.txt), upstream attribution in [data/wordfreq-NOTICE.md](data/wordfreq-NOTICE.md), and the data license in [data/wordfreq-data-LICENSE.txt](data/wordfreq-data-LICENSE.txt). These notices are included in deployments. The common list retains the separate SOWPODS provenance described above. Two- and three-letter choices are preserved in both dictionary modes. The displayed optimum is always for the active dictionary and current rejections; switching to common words may reduce the best achievable score.

The common list is bundled, so the app and Cloudflare build still need no Python or npm packages. To regenerate it during development, install `wordfreq==3.1.1` in a Python environment, then run:

```sh
python3 scripts/generate-common-words.py
```

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

Tests cover the shape catalogue and scores, dictionary integrity, 17-point solutions with zero through four blanks, blank sharing at crossings, insufficient blanks, two- and three-letter filtering, repeated-letter constraints, a lower optimum, unused tiles, no-word racks, connectivity and invalid inputs. Play-board tests cover quick entry, collision prevention, returning tiles, crossings, invalid-word highlighting, unset blanks, disconnected arrangements, expanding bounds and score agreement with solver results. Result validation independently reconstructs the board and every word, including the exact physical tiles and blanks spent.
