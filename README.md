# Pogo Lucky Tracker

Static site publishing Lucky/Shiny/XXL Pokédex scan results produced by the
[pogo-data](https://github.com/danwarddev/pogo-data) pipeline. No backend —
plain HTML/CSS/JS reads JSON files in `data/`, served via GitHub Pages.

Deliberately public-but-unlisted: not indexed or discoverable, but anyone
with the exact URL can view it. This repo holds **only** generated scan
results (dex numbers + stats) — no capture video, no calibration profiles,
no other personal data. Those stay in the private `pogo-data` repo, along
with the hand-maintained correction files composed into these results (see
"Manual corrections" below).

## Live site

GitHub Pages is enabled (Settings → Pages → Source: Deploy from a branch →
`main` → `/ (root)`):

```
https://danwarddev.github.io/pogo-results/
```

## Data schema

`data/manifest.json` — index of all published people/tabs:

```json
{
  "generated_at": "2026-09-13T21:13:06Z",
  "people": [
    {
      "person": "dan",
      "display_name": "AgentAyers",
      "tabs": {
        "lucky": {
          "device_label": "dan-lucky",
          "scanned_at": "2026-09-13T21:13:06Z",
          "stats": { "have": 437, "need": 550, "needs_review": 21, "total": 987 }
        }
      }
    }
  ]
}
```

`data/<person>/<tab>.json` — one scan's full result, **with manual
corrections applied** (see "Manual corrections" below):

```json
{
  "person": "dan",
  "display_name": "AgentAyers",
  "tab": "lucky",
  "device_label": "dan-lucky",
  "scanned_at": "2026-09-13T21:13:06Z",
  "stats": { "have": 437, "need": 550, "needs_review": 21, "total": 987, "corrected": 2 },
  "have": [1, 2, 3],
  "need": [4, 5, 6],
  "still_want": [60, 133]
}
```

`tab` is one of `lucky` / `shiny` / `xxl` (matches the Pokédex tab scanned).
`device_label` is informational only (auto-derived from the source video's
filename by pogo-data's auto-calibration — not a stable per-device id).
`have`/`need` are plain dex-number arrays — no zero-padding, matching the
format the in-game search bar accepts as a comma-separated OR filter.
`stats.corrected` is how many dex numbers a manual correction changed from
the raw scan (flipped state, or added outright) — `0` when no corrections
file existed for that person/tab.
`still_want` is dex numbers this person genuinely `have` (not a correction
of a wrong read) but still wants another Lucky trade of — a split evolution
line's shared base/mid stage where they've only claimed one branch (Poliwag,
Oddish/Gloom, Eevee, ...), or just a wanted duplicate. It never affects
`have`/`need` or the stats — the solo view above ignores it entirely — see
"Comparison view" below for the one place it's read.

Only the **latest** scan per person/tab is kept; a new publish overwrites
the previous one for that person/tab (history isn't tracked here by design).

`data/<person>/<tab>.raw.json` also exists alongside each published scan —
the scan's result *before* corrections, kept only so pogo-data can
re-apply an edited corrections file later without re-running OCR on the
video. It's an internal pipeline artifact: this site's `app.js` never
fetches it, and it isn't part of the schema above.

## Publishing a new scan

From a `pogo-data` checkout:

```
python scripts/lucky_lists.py <video> \
    --person dan --display-name AgentAyers --tab lucky --publish-dir /path/to/pogo-results
```

Grid geometry auto-calibrates from the video itself — no separate
calibration step or device label needed. `--display-name` (an alias, an
in-game avatar name works well) is required alongside `--publish-dir`;
it's never derived automatically from `--person`.

That writes `data/dan/lucky.raw.json` (the scan, untouched), applies any
existing corrections for `dan`/`lucky`, and writes the corrected
`data/dan/lucky.json` + updates `data/manifest.json` in the given
directory. Commit and push this repo to publish:

```
git add data && git commit -m "Publish dan lucky scan" && git push
```

## Manual corrections

`pogo-data` generates a scan from video, but it's not always right, and it
can't cover a dex number the video never scrolled past. `pogo-data` keeps a
hand-maintained override file per person/tab
(`corrections/<person>/<tab>.json` in that repo — see its README) for
exactly that: force a dex number to `have` or `need` regardless of what the
scan found. The published `data/<person>/<tab>.json` here is always the
scan **composed with** whatever that file said at publish time.

After editing a correction, you don't need a new video capture — from a
`pogo-data` checkout:

```
python scripts/apply_corrections.py --publish-dir /path/to/pogo-results --person dan --tab lucky
```

This re-applies the corrections file to the existing `lucky.raw.json` here
and rewrites `lucky.json` + `manifest.json`. Commit and push the same way
as a fresh scan.

## Comparison view

The "Compare two" view buckets every dex number for a shared tab between
two people into four priority groups, based on Pokémon GO's actual trade
mechanics (a Pokémon can only ever be traded once, so someone already
having a Lucky doesn't mean they have a tradeable spare — it just means
their shot at Lucky for that species is already spent):

1. **Both still need** — top priority. Neither has a Lucky yet, so a
   mirror trade (or any trade of that species between the two of you)
   gives both of you a shot.
2. **Only one still needs** (two symmetric buckets) — worth the person who
   already has it keeping a spare copy around to trade the other.
3. **Neither needs** — safe to toss/deprioritize; no Lucky value left for
   either of you on that species.

A person's `still_want` list (see the data schema above) is folded into
"still needs" for this bucketing only — it never touches the numbers or
stats shown on the solo view. Someone with a `have` Eevee they've put
`still_want`-listed still shows up wanting a mirror trade for it, and a
number stays out of "neither needs" if either person still wants it, even
though both already `have` it.
