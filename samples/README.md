# Sketch-thru-Plan Samples

Samples illustrate different aspects of STP in an incremental fashion, with each sample building on a previous one, adding capabilities. 

* [Quickstart](../quickstart) - bare-bones foundational example
* [Basic](basic) - enhances the speech recognition strategy and adds a military symbol renderer. 
Unified sample with adapter selection (Leaflet or Google Maps) for experimenting with either map provider.
* [Tasks](tasks) - demonstrates how automatically detected Tasks can be handled
* [TaskOrg](to) - demonstrates handling of Task Org/ORBAT definitions
* [Roles](roles) - demonstrates role switching
* [Scenario](scenario) - demonstrates management of scenario data
* [Sessions](session) - demonstrates connection to STP server sessions
* [Custom Commands](commands) - demonstrates the definition of custom commands
* [C2SIM](c2sim) - demonstrates generation of C2SIM-compliant documents and server interaction, including the 5.12
`refuseUnconfirmedPlaceholders` option
* [COAs](coas) - lists, adds, renames, deletes and selects Courses of Action, exports and imports them, and ties a
task org to a COA (STP 5.12 COA API)
* [Task history](taskhistory) - shows a task's history, follows it live and adds, edits and deletes comments (STP 5.12)
* [Change sets](changesets) - shows which object events arrived together, as one change set (STP 5.12)
* [Object sets](objectsets) - reads and writes scenarios, task orgs and COAs as object sets, with a load timeout and
the report STP gives when a load stops (STP 5.12)
* [Symbol search](symbolsearch) - searches the symbol index from typed text; runs without STP against the contract's
test index (STP 5.12)
* [ArcGIS](arcgis) - variation of the [C2SIM](c2sim) sample that demonstrates the use of the ArcGIS map plugin, in two variations:
    * [TypeScript](arcgis/ts) - plain TypeScript app that replicates the [C2SIM](c2sim) functionality directly
    * [React](arcgis/react) - React app with some interface enhancements

## STP 5.12 API coverage

[PARITY.md](PARITY.md) lists every method and event of the STP contract, the JS SDK member that carries it and
the JS samples that show it, and the same for the .NET SDK and its samples. It is generated from the contract: run
`node scripts/sample-parity.mjs` at the repository root after changing a sample (`--check` reports whether it is
out of date). The .NET columns come from `samples/parity-net.json`, which records the .NET branch and commit it was
taken from; refresh it with `node scripts/sample-parity.mjs --net <path to a clone of sketch-thru-plan-sdk-net>`
(the 5.12 branch: the .NET names follow its `docs/articles/contract-name-mapping.md`). Without that file the table
has the JS columns only.

## Which SDK build the samples load

The samples load this repository's own build of the SDK (`dist/sketch-thru-plan-sdk-bundle-min.js`) and of the
plugins (`plugins/*/*/dist`), so they always show the API of the branch they are on - the STP 5.12 API on
`release/5.12`. Build once at the repository root before opening a sample:

```
npm ci
npm run build:all
npm start          # serves the repository root and opens samples/index.html
```

Each sample's `index.html` carries, commented out, the jsDelivr tag for the published package, pinned to
`sketch-thru-plan-sdk@0.6.17` - the first release with the 5.12 API. Swap the local tag for it once 0.6.17
is published to use the CDN instead of a local build. Do not use `@latest` or an earlier version: 0.6.16
and earlier implement an older contract and lack the 5.12 methods (for example `updateCoa`, the ENGINEER role
and the `refuseUnconfirmedPlaceholders` C2SIM option).

Note: All samples and quickstarts use `leaflet` as the default map adapter. To try Google Maps, see the [Basic](basic) sample.
 