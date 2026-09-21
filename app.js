// Pogo Lucky Tracker — static front end over data/manifest.json + data/<person>/<tab>.json.
// No build step: plain fetch + DOM. See README.md for the data schema this expects.

const TAB_LABELS = { lucky: "Lucky", shiny: "Shiny", xxl: "XXL" };

const state = {
  manifest: null,
  mode: "solo", // "solo" | "compare"
  solo: { person: null, tab: null },
  compare: { personA: null, personB: null, tab: null },
};

main();

async function main() {
  const app = document.getElementById("app");
  try {
    state.manifest = await fetchJSON("data/manifest.json");
  } catch (e) {
    app.innerHTML = "";
    app.appendChild(el("p", { class: "error" }, `Couldn't load scan data (${e.message}).`));
    return;
  }

  const people = state.manifest.people || [];
  if (people.length === 0) {
    app.innerHTML = "";
    app.appendChild(
      el("div", { class: "empty" }, [
        el("p", {}, "No scans published yet."),
        el(
          "p",
          {},
          "Run scripts/lucky_lists.py from the pogo-data pipeline with --publish-dir pointing at a checkout of this repo, then commit + push data/."
        ),
      ])
    );
    return;
  }

  state.solo.person = people[0].person;
  state.solo.tab = firstTab(people[0]);
  const pair = defaultComparePair(people);
  state.compare.personA = pair.a;
  state.compare.personB = pair.b;
  state.compare.tab = pair.tab;

  render();
}

function firstTab(person) {
  const tabs = Object.keys(person.tabs || {});
  return tabs[0] || null;
}

function commonTabs(personA, personB) {
  if (!personA || !personB) return [];
  const tabsA = new Set(Object.keys(personA.tabs || {}));
  return Object.keys(personB.tabs || {}).filter((t) => tabsA.has(t));
}

function defaultComparePair(people) {
  for (let i = 0; i < people.length; i++) {
    for (let j = 0; j < people.length; j++) {
      if (i === j) continue;
      const tabs = commonTabs(people[i], people[j]);
      if (tabs.length > 0) {
        return { a: people[i].person, b: people[j].person, tab: tabs[0] };
      }
    }
  }
  return { a: people[0]?.person || null, b: people[1]?.person || null, tab: null };
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  app.appendChild(
    el("nav", { class: "mode-switch" }, [
      el(
        "button",
        {
          class: state.mode === "solo" ? "active" : "",
          onclick: () => {
            state.mode = "solo";
            render();
          },
        },
        "Single person"
      ),
      el(
        "button",
        {
          class: state.mode === "compare" ? "active" : "",
          onclick: () => {
            state.mode = "compare";
            render();
          },
        },
        "Compare two"
      ),
    ])
  );

  if (state.mode === "solo") {
    app.appendChild(renderSolo());
  } else {
    app.appendChild(renderCompare());
  }
}

function renderSolo() {
  const container = el("div", {});
  const people = state.manifest.people;
  const person = people.find((p) => p.person === state.solo.person) || people[0];
  const tabs = Object.keys(person.tabs || {});
  if (!state.solo.tab || !tabs.includes(state.solo.tab)) state.solo.tab = tabs[0];

  container.appendChild(
    el("div", { class: "picker-row" }, [
      personSelect(state.solo.person, (value) => {
        state.solo.person = value;
        state.solo.tab = firstTab(people.find((p) => p.person === value));
        render();
      }),
      tabSelect(tabs, state.solo.tab, (value) => {
        state.solo.tab = value;
        render();
      }),
    ])
  );

  if (!state.solo.tab) {
    container.appendChild(el("p", { class: "empty" }, `No scans yet for ${displayName(person)}.`));
    return container;
  }

  const placeholder = el("p", { class: "loading" }, "Loading scan…");
  container.appendChild(placeholder);

  fetchJSON(`data/${person.person}/${state.solo.tab}.json`)
    .then((scan) => {
      placeholder.replaceWith(renderSoloScan(scan));
    })
    .catch((e) => {
      placeholder.replaceWith(el("p", { class: "error" }, `Couldn't load that scan (${e.message}).`));
    });

  return container;
}

function renderSoloScan(scan) {
  const frag = el("div", {});
  frag.appendChild(scanMeta(scan));
  frag.appendChild(
    copyCard({
      title: "Need",
      note: "Not yet a Lucky — paste into the in-game search bar to find candidates.",
      numbers: scan.need,
      cls: "need",
    })
  );
  frag.appendChild(
    copyCard({
      title: "Have",
      note: "Already a Lucky — safe to deprioritize when deciding what to keep.",
      numbers: scan.have,
      cls: "have",
    })
  );
  return frag;
}

function scanMeta(scan) {
  const stats = scan.stats || {};
  const row = el("div", { class: "stats-row" }, [
    el("span", {}, [el("strong", {}, String(stats.total ?? "?")), " total"]),
    el("span", {}, [el("strong", {}, String(stats.have ?? "?")), " have"]),
    el("span", {}, [el("strong", {}, String(stats.need ?? "?")), " need"]),
    stats.needs_review
      ? el("span", {}, [el("strong", {}, String(stats.needs_review)), " flagged for review"])
      : null,
  ]);
  const meta = el(
    "p",
    { class: "meta" },
    `${scan.device_label || "unknown device"} · scanned ${formatDate(scan.scanned_at)}`
  );
  const wrap = el("div", {}, [row, meta]);
  return wrap;
}

function renderCompare() {
  const container = el("div", {});
  const people = state.manifest.people;

  if (people.length < 2) {
    container.appendChild(el("p", { class: "empty" }, "Need at least two people's scans to compare."));
    return container;
  }

  if (!state.compare.personA) state.compare.personA = people[0].person;
  if (!state.compare.personB || state.compare.personB === state.compare.personA) {
    state.compare.personB = people.find((p) => p.person !== state.compare.personA)?.person;
  }

  const personA = people.find((p) => p.person === state.compare.personA);
  const personB = people.find((p) => p.person === state.compare.personB);
  const tabs = commonTabs(personA, personB);
  if (!state.compare.tab || !tabs.includes(state.compare.tab)) state.compare.tab = tabs[0] || null;

  container.appendChild(
    el("div", { class: "picker-row" }, [
      personSelect(state.compare.personA, (value) => {
        state.compare.personA = value;
        if (state.compare.personB === value) state.compare.personB = null;
        state.compare.tab = null;
        render();
      }),
      personSelect(state.compare.personB, (value) => {
        state.compare.personB = value;
        state.compare.tab = null;
        render();
      }, state.compare.personA),
    ])
  );

  if (!tabs.length) {
    container.appendChild(
      el("p", { class: "empty" }, `${displayName(personA)} and ${displayName(personB)} have no scanned tab in common yet.`)
    );
    return container;
  }

  container.appendChild(
    el("div", { class: "picker-row" }, [
      tabSelect(tabs, state.compare.tab, (value) => {
        state.compare.tab = value;
        render();
      }),
    ])
  );

  const placeholder = el("p", { class: "loading" }, "Loading scans…");
  container.appendChild(placeholder);

  Promise.all([
    fetchJSON(`data/${personA.person}/${state.compare.tab}.json`),
    fetchJSON(`data/${personB.person}/${state.compare.tab}.json`),
  ])
    .then(([scanA, scanB]) => {
      placeholder.replaceWith(renderComparison(scanA, scanB));
    })
    .catch((e) => {
      placeholder.replaceWith(el("p", { class: "error" }, `Couldn't load those scans (${e.message}).`));
    });

  return container;
}

function renderComparison(scanA, scanB) {
  const nameA = scanA.display_name || scanA.person;
  const nameB = scanB.display_name || scanB.person;
  const haveA = new Set(scanA.have);
  const haveB = new Set(scanB.have);
  // "wanted" = still needs a Lucky trade for this species, either because
  // the scan says need, or because a still_want correction says so despite
  // already having one (a split-evolution branch not yet claimed, or a
  // wanted duplicate) -- see README's "Comparison view" section.
  const wantedA = union(scanA.need, scanA.still_want);
  const wantedB = union(scanB.need, scanB.still_want);

  const bothNeed = intersect(wantedA, wantedB);
  // Subtract wantedB/wantedA so a number both people still want (already
  // in bothNeed) doesn't also land in one of the "only" buckets below.
  const onlyANeeds = intersect(difference(wantedA, wantedB), haveB);
  const onlyBNeeds = intersect(difference(wantedB, wantedA), haveA);
  const neitherNeeds = difference(intersect(haveA, haveB), union(wantedA, wantedB));

  const frag = el("div", {});
  frag.appendChild(
    el(
      "p",
      { class: "meta" },
      `${nameA} scanned ${formatDate(scanA.scanned_at)} · ${nameB} scanned ${formatDate(scanB.scanned_at)}`
    )
  );

  frag.appendChild(
    copyCard({
      title: "Both still need — top priority",
      note: "Neither has a Lucky yet (or wants another for a different evolution branch). A mirror trade here gives both of you a shot.",
      numbers: bothNeed,
      cls: "both-need",
    })
  );
  frag.appendChild(
    copyCard({
      title: `Only ${nameB} still needs`,
      note: `${nameA} already has it — worth ${nameA} keeping a spare to trade ${nameB}.`,
      numbers: onlyBNeeds,
    })
  );
  frag.appendChild(
    copyCard({
      title: `Only ${nameA} still needs`,
      note: `${nameB} already has it — worth ${nameB} keeping a spare to trade ${nameA}.`,
      numbers: onlyANeeds,
    })
  );
  frag.appendChild(
    copyCard({
      title: "Neither needs — safe to toss",
      note: "Both already have a Lucky of these. No trade value left for either of you here.",
      numbers: neitherNeeds,
      cls: "toss",
    })
  );

  return frag;
}

function intersect(setA, setB) {
  return [...setA].filter((x) => setB.has(x)).sort((a, b) => a - b);
}

function union(...iterables) {
  const out = new Set();
  for (const it of iterables) {
    for (const x of it || []) out.add(x);
  }
  return out;
}

function difference(setA, setB) {
  return new Set([...setA].filter((x) => !setB.has(x)));
}

function copyCard({ title, note, numbers, cls }) {
  const list = Array.isArray(numbers) ? numbers : [...numbers];
  const sorted = [...list].sort((a, b) => a - b);
  const text = sorted.join(",");

  const card = el("div", { class: `card${cls ? " " + cls : ""}` });
  card.appendChild(
    el("div", { class: "card-title" }, [el("h3", {}, title), el("span", { class: "count" }, `${sorted.length}`)])
  );
  if (note) card.appendChild(el("p", { class: "card-note" }, note));

  if (sorted.length === 0) {
    card.appendChild(el("p", { class: "card-note" }, "Nothing here."));
    return card;
  }

  const preview = el("code", { class: "copy-preview" }, text);
  const btn = el("button", { class: "copy-btn" }, "Copy");
  btn.addEventListener("click", () => copyToClipboard(text, btn));

  card.appendChild(el("div", { class: "copy-row" }, [preview, btn]));
  return card;
}

async function copyToClipboard(text, btn) {
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied!";
  } catch (e) {
    btn.textContent = "Select & copy";
  }
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1500);
}

function personSelect(selected, onChange, exclude) {
  const options = state.manifest.people
    .filter((p) => p.person !== exclude)
    .map((p) => el("option", { value: p.person, selected: p.person === selected ? "selected" : null }, displayName(p)));
  const select = el("select", {}, options);
  select.value = selected || "";
  select.addEventListener("change", (e) => onChange(e.target.value));
  return select;
}

function tabSelect(tabs, selected, onChange) {
  const options = tabs.map((t) =>
    el("option", { value: t, selected: t === selected ? "selected" : null }, TAB_LABELS[t] || t)
  );
  const select = el("select", {}, options);
  select.value = selected || "";
  select.addEventListener("change", (e) => onChange(e.target.value));
  return select;
}

function displayName(person) {
  return (person && (person.display_name || person.person)) || "?";
}

function formatDate(iso) {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// Tiny hyperscript-ish helper: el("div", {class: "x", onclick: fn}, ["children" | "text" | Node])
function el(tag, props, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key === "onclick") node.addEventListener("click", value);
    else if (key === "class") { if (value) node.className = value; }
    else node.setAttribute(key, value);
  }
  const kids = Array.isArray(children) ? children : children == null ? [] : [children];
  for (const kid of kids) {
    if (kid == null) continue;
    node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return node;
}
