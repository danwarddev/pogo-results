# Pogo Lucky Tracker

Static site publishing Lucky/Shiny/XXL Pokédex scan results produced by the
[pogo-data](https://github.com/danwarddev/pogo-data) pipeline. No backend —
plain HTML/CSS/JS reads JSON files in `data/`, served via GitHub Pages.

Deliberately public-but-unlisted: not indexed or discoverable, but anyone
with the exact URL can view it. This repo holds **only** generated scan
results (dex numbers + stats) — no capture video, no calibration profiles,
no other personal data. Those stay in the private `pogo-data` repo.

## Live site

Once GitHub Pages is enabled for this repo (Settings → Pages → Source:
Deploy from a branch → `main` → `/ (root)`), it'll be reachable at:

```
https://danwarddev.github.io/pogo-results/
```

## Data schema

`data/manifest.json` — index of all published people/tabs:

```json
{
  "generated_at": "2026-09-13T00:00:00Z",
  "people": [
    {
      "person": "dan",
      "display_name": "Dan",
      "tabs": {
        "lucky": {
          "device_label": "pixel9a_kanto_lucky",
          "scanned_at": "2026-09-13T00:00:00Z",
          "stats": { "have": 434, "need": 553, "needs_review": 34, "total": 987 }
        }
      }
    }
  ]
}
```

`data/<person>/<tab>.json` — one scan's full result:

```json
{
  "person": "dan",
  "display_name": "Dan",
  "tab": "lucky",
  "device_label": "pixel9a_kanto_lucky",
  "scanned_at": "2026-09-13T00:00:00Z",
  "stats": { "have": 434, "need": 553, "needs_review": 34, "total": 987 },
  "have": [1, 2, 3],
  "need": [4, 5, 6]
}
```

`tab` is one of `lucky` / `shiny` / `xxl` (matches the Pokédex tab scanned).
`have`/`need` are plain dex-number arrays — no zero-padding, matching the
format the in-game search bar accepts as a comma-separated OR filter.

Only the **latest** scan per person/tab is kept; a new publish overwrites
the previous one for that person/tab (history isn't tracked here by design).

## Publishing a new scan

From a `pogo-data` checkout, after running the extraction pipeline:

```
python scripts/lucky_lists.py <video> <device_label> \
    --person dan --tab lucky --publish-dir /path/to/pogo-results
```

That writes `data/dan/lucky.json` and updates `data/manifest.json` in the
given directory. Commit and push this repo to publish:

```
git add data && git commit -m "Publish dan lucky scan" && git push
```

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
