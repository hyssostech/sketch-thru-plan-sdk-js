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
* [C2SIM](c2sim) - demonstrates generation of C2SIM-compliant documents and server interaction
* [ArcGIS](arcgis) - variation of the [C2SIM](c2sim) sample that demonstrates the use of the ArcGIS map plugin, in two variations:
    * [TypeScript](arcgis/ts) - plain TypeScript app that replicates the [C2SIM](c2sim) functionality directly
    * [React](arcgis/react) - React app with some interface enhancements

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
 