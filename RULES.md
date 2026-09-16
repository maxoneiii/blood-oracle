# Rules reference

The rules reference is **not** part of this module and must never be committed
to a repository or bundled into a distributed package. It is close to verbatim
rulebook text across some thirty books. The module works without it — every
field can be entered by hand — so treat it as a private convenience.

## Generating the file

From a copy of the standalone Blood Oracle source:

```bash
node tools/extract-rules.mjs /path/to/blood_oracle.jsx blood-oracle-rules.json
```

The extractor reads `FULL_RULES` and `POWERS` out of the app, maps discipline
display names onto the system's keys (Blood Sorcery becomes `sorcery`,
Thin-Blood Alchemy becomes `alchemy`), strips amalgam suffixes from power names
while keeping the requirement, and folds rituals and ceremonies into the two
pseudo-disciplines wod5e provides for them.

Expect roughly 399 entries, 12 discipline overviews, 16 clans, 17 predator
types, 76 merits and 108 flaws — about 620 KB.

The file also carries the Humanity table, Blood Potency ranges by generation,
and the resonance and temperament lists. If you generated a file before these
were added, regenerate it — the Blood tab falls back to typed input without
them.

## Installing it

Copy the JSON somewhere under Foundry's Data directory, for example:

```
Data/blood-oracle/blood-oracle-rules.json
```

Then set **Rules reference file** in the module settings to that path, relative
to Data. The default matches the example above. Leave the setting empty to run
without a reference.

Foundry serves the Data directory over HTTP, so every connected client fetches
the same file. Players get the reference without any further setup, and
replacing that one file updates everyone on their next reload.

Put the file in a directory of its own rather than inside the module folder —
reinstalling or updating the module would otherwise delete it.

## What the reference changes

- **Power form** gains a search box that fills every field from a reference
  entry. The fields stay editable afterwards.
- **Import** resolves levels and rules text for powers that arrive as bare
  names. Without a reference they import at level 0 with no text.
- **Prerequisites** can be checked. Amalgams are read from the power's own
  name and work without a reference; prose prerequisites like
  "Cloak of Shadows or Unseen Passage" need one, and are reported as unknown
  rather than unmet when it is missing.
- **Discipline detail** shows the overview, type, Masquerade threat and
  resonance.
- **Merits & flaws** gain the catalogue picker, grouped by category, with the
  book's rating range carried alongside the rating the character bought.
- **Blood tab** gains the clan list, bane and compulsion text, the Humanity
  penalty for the current rating, Blood Potency range for the generation, and
  the predator type breakdown. Without a reference the clan is typed by hand
  and the descriptive text is simply absent.

## Known gaps in the source data

Seven entries have no rules text, because they appear in the app's power lists
but not in its rules table:

- Thin-Blood Alchemy: Counterfeit Discipline, Saraimu
- Rituals: Bloody Message, Letter Ward, Sanguine Tidings, Sleep of Judas,
  Seek the Gathered Vitae

They still import and can be filled in by hand.
