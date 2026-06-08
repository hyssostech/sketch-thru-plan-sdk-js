Publish checklist
-----------------

1. Update package.json version
1. Build with `npm run build`
1. Git commit, push and tag
1. npm publish
1. cp -rf docs/ ../stp-docs/sdk, git commit, push and tag the `stp-docs` repository to update the github.io pages

1. If not using @latest - Update the version of the `script` in the `sketch-thru-plan-sdk-resources` repository
    * quickstart \> js&ts \> index.html
    * quickstart \> js&ts \> README.md
1. Git commit, push and tag the `sketch-thru-plan-sdk-js` repository
1. Create a new Release for `sketch-thru-plan-sdk-js` in github

Tools
-----

Playcode - console + html environment (limited to a few chars) https://playcode.io/new/ 
Geojson viewer https://geojson.io/#map=10/35.3790/-105.4303
JSON pretty print https://geojson.io/#map=10/35.3790/-105.4303
SVG editor /  viewer https://www.freecodeformat.com/svg-editor.php

Resources
---------

In-depth guide to configuring ts NPM - kjaer.io/ts-npm-config/
Rollup name - Global variable name representing the created bundle - https://dev.to/proticm/how-to-setup-rollup-config-45mk
Build Rollup UMD bundle for CommonJS - https://remarkablemark.org/blog/2019/07/12/rollup-commonjs-umd/
Integration testing WebSocket server in Node.JS - https://medium.com/@basavarajkn/integration-testing-websocket-server-in-node-js-2997d107414c
Format converters - https://transform.tools/json-schema-to-typescript
Google Maps custom SVG overlays - https://mapsvg.com/tutorials/4.0.x/3/ https://developers.google.com/maps/documentation/javascript/customoverlays http://jsfiddle.net/7b3byzrf/27/ 
Google infowindows property editing https://stackoverflow.com/questions/31494380/google-maps-change-content-of-infowindow

Microsoft Speech in container - https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/speech-container-howto?tabs=stt%2Ccsharp%2Csimple-format

Speech benchmark, offline recos - https://picovoice.ai/blog/local-speech-to-text-with-cloud-level-accuracy/

Cleanup commands
----------------

    "stripdev": "copyfiles --flat ./src/*-dev.ts ./src/*.html ./dist && replace-in-file /\\/\\*\\-\\*\\/.*/\\*\\-\\*\\//g ''  ./dist/*.js --isRegex",
    "striphtml": "replace-in-file /<!-- - -->.*<!-- - -->/g ''  index-dev.html --isRegex"

Tags
----

![GitHub release (latest by date)](https://img.shields.io/github/v/release/hyssostech/sketch-thru-plan-sdk-resources) [![](https://data.jsdelivr.com/v1/package/npm/sketch-thru-plan-sdk-resources/badge)](https://www.jsdelivr.com/package/npm/sketch-thru-plan-sdk-resources) ![GitHub All Releases](https://img.shields.io/github/downloads/hyssostech/sketch-thru-plan-sdk-resources/total) ![GitHub](https://img.shields.io/github/license/hyssostech/sketch-thru-plan-sdk-resources)

