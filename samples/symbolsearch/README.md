# Symbol search sample

`SearchSymbol` (STP 5.12) finds the symbols whose names or spoken phrases match typed text, best first - what a
symbol editor's search box or a type-and-sketch flow lists. It is answered by the SDK itself, from the symbol index
it loads: the engine never receives the search, so it costs no round trip.

This sample needs no map, renderer or speech. It loads the SDK only:

```html
<script src="../../dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

Build the SDK once at the repository root (`npm ci`, `npm run build`), then serve the repository (`npm start`).

## Trying it without STP

The page starts with the URL of the invented index that ships with the contract
(`json-api/symbol-search/fixture-index.json`). Press **Load** and search for `zephyr`.

## Code walkthrough

### Loading an index

```javascript
// The index served by the STP bridge the connector is connected to (STP 5.11.2 or later)
await stpsdk.connect(appName, 30);
const symbolSearch = await StpSDK.SymbolSearch.load();

// ... or any index file, by URL
const symbolSearch = await StpSDK.SymbolSearch.load(url);
```

A missing index is an error, never an empty result: `load` rejects with a `SymbolIndexUnavailableError` whose
message is `symbol index not available: <source> (<reason>)` - an older STP, a missing install or a bad file each
give their reason.

### Searching

```javascript
const results = symbolSearch.search('recon platoon', 20);
for (const r of results) {
    // r.name, r.speech (the phrase that matched), r.gesture ('point', or a graphic's 'line', 'area', ...),
    // r.defaultAffiliation, r.deltaSidc (2525D), r.charlieSidc (2525C), r.key, r.score
}
```

Results come best first, at most `maxResults` (default 20). Text of only spaces or stop words, or no match, gives
`[]`. Scores are comparable only within one answer.
