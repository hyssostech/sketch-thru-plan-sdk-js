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

Note: All samples and quickstarts use `leaflet` as the default map adapter. To try Google Maps, see the [Basic](basic) sample.
 