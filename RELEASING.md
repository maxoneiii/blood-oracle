# Releasing

The module can be installed by hand from a zip, or through a manifest URL so
Foundry handles updates itself. Both are described below.

The rules reference is not part of either. It is generated locally by
`tools/extract-rules.mjs` and lives in Foundry's `Data` directory — see
`RULES.md`. Every client fetches it from the server over HTTP, so only the
machine running Foundry needs a copy, and players need nothing.

## By hand

```
npm install
npm run build
```

Copy `module.json`, `dist/`, `icons/` and `fonts/` into
`Data/modules/blood-oracle/` on the Foundry server, then reload.

That is all a single table needs. Players are served the module by the same
Foundry server, so nothing is installed on their machines.

## Through GitHub, with updates

### One-time setup

Create a repository and replace `your-name/blood-oracle` in `module.json` with
its path. Three fields matter:

- `url` — where the repository lives
- `manifest` — the manifest Foundry re-checks when looking for updates
- `download` — the archive Foundry fetches when installing or updating

Both point at `releases/latest/download/…`, so they keep working for every
release without being edited again.

The repository has to be public for Foundry to reach those URLs. That is safe:
the reference file is excluded by `.gitignore`, and nothing else in the module
carries text from the books.

New to git? `GITHUB.md` walks through the whole thing step by step, on Windows,
assuming no prior knowledge.

### Each release

```
./tools/release.sh          # bash, or Git Bash on Windows
tools\release.ps1           # PowerShell
```

It builds the module and writes two files into `build/`:

- `module.zip` — the module itself
- `module.json` — the manifest, copied out for convenience

Raise `version` in `module.json` first — Foundry compares it against the
installed copy to decide whether an update exists. Then create a GitHub release
tagged with that version and attach **both** files to it. The filenames must
stay exactly `module.zip` and `module.json`, because the URLs in the manifest
name them.

### Installing

In Foundry: Add-on Modules → Install Module → paste the `manifest` URL.
Afterwards Foundry offers updates on its own whenever a newer release appears.

## After updating

Sheet assignments survive updates: Foundry stores them against
`blood-oracle.BloodOracleSheet`, and that name is pinned in code so a minifier
cannot change it between builds.

If the reference is in `Data/blood-oracle/`, as it should be, reinstalling the
module never touches it. Keep it out of `Data/modules/blood-oracle/`, which is
replaced wholesale on update.
