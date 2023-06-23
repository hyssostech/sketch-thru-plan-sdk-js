# Plugins and reusable code

The Sketch-thru-Plan SDK can be configured to use a few different plugins:

* Connector plugins - handle the communication to a backend system that runs the STP services. A Websockets based connector bundled with the SDK can be examined [here](connectors/websockets-plugin).
* Speech recognition plugins - speech recognition engines can be swapped. The Microsoft Cognitive Services Speech plugin bundled with the SDK can be examined [here](speech/azurespeech-plugin).
* Map plugins - STP is map agnostic, and can operate with a variety of services. A Google Maps based service can be examined [here](maps/googlemaps)
* Renderers - the actual display of symbols on a map can be achieved by different components. A renderer based on a combination of two open source renderers can be examined [here](renderers)