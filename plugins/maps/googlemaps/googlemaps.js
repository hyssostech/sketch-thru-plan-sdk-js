/**
 * Sketch collection and feature display on Google Maps
 * // Adapted from https://stackoverflow.com/a/22808047
 */
class GoogleMap  {
    //#region Events 
    onStrokeStart;
    onStrokeCompleted;
    onSelection;
    //#endregion Events

    //#region Properties
    apiKey;
    mapCenter;
    zoomLevel;
    mapDivId;

    #map;
    #strokeStart;
    #strokeEnd;
    #strokePoly;
    #moveListener;
    #assets;
    //#endregion
    
    //#region Construction and initialization
    /**
     * Construct a Google Maps object
     * @param apiKey API key to use
     * @param mapDivId Id of the HTML div where #map is presented
     * @param mapCenter Coordinates of the center of the #map region displayed on load
     * @param zoomLevel Zoom level of the #map region displayed on load
     */
    constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
        this.apiKey = apiKey;
        this.mapDivId = mapDivId;
        this.mapCenter = mapCenter;
        this.zoomLevel = zoomLevel;

        // Initialize sketched ink structures
        this.#strokeStart = this.#strokeEnd = '';

        // Add structure to track markers added to features
        this.#assets = new Map();
    }

    /**
     * Load google maps, linking to our initialization callback
     * See https://www.npmjs.com/package/@googlemaps/js-api-loader 
     */
    load = async () => {
        let loader = new google.maps.plugins.loader.Loader({
            apiKey: this.apiKey,
            version: "weekly",
        });
        loader.loadCallback(async e => {
            if (e) {
                console.log(e);
                throw new Error(e);
            } else {
                await this.initMap();
            }
        });
    }

    /**
     * Initialize google maps and the STP SDK, setting up the stroke capture events
     * THe standard mode is drawing/sketching - users need to hold the Ctrl key to be able to use the mouse
     * in a conventional (drag) way
     */
    initMap = async () => {
        // Load #map
        const mapDiv = document.getElementById(this.mapDivId);
        if (!mapDiv) {
            throw new Error("Html page must contain a '#map' div");
        }
        this.#map = new google.maps.Map(
            mapDiv,
            {
                mapTypeId: google.maps.MapTypeId.TERRAIN,
                zoom: this.zoomLevel,
                center: { lat: this.mapCenter.lat, lng: this.mapCenter.lon },
                gestureHandling: 'cooperative',
                draggable: true,
                draggableCursor: 'crosshair'
            });
        const mapStyles /*google.maps.MapTypeStyle*/ = 
            [
                {
                    "featureType": "administrative",
                    "elementType": "geometry",
                    "stylers": [
                    {
                        "visibility": "off"
                    }
                    ]
                },
                {
                    "featureType": "poi",
                    "stylers": [
                    {
                        "visibility": "off"
                    }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "labels.icon",
                    "stylers": [
                    {
                        "visibility": "off"
                    }
                    ]
                },
                {
                    "featureType": "transit",
                    "stylers": [
                    {
                        "visibility": "off"
                    }
                    ]
                }
            ];
        this.#map.setOptions({ styles: mapStyles });
        
        // Set the styling of the geojson data layer, processing features with associated additional svg rendering
        this.#map.data.setStyle((feature) => {
            let rend = feature.getProperty('rendering');
            if (rend) {
                for (let i = 0; i < rend.length; i++) {
                    let shape = rend[i].shape.map(item => { return [item.x, item.y]; }).flat();
                    let marker = new google.maps.Marker({
                        map: this.#map,
                        icon: {
                            url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                            anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                        },
                        shape: {
                            type: 'poly',
                            coords: shape
                        },
                        cursor: 'default',
                        position: { lat: rend[i].position.lat, lng: rend[i].position.lon },
                    });
                    if (rend[i].title) {
                        marker.setTitle(rend[i].title);
                    }
                    // Right-click to select
                    marker.addListener("rightclick", () => {
                        this.onSelection?.call(this, feature.getProperty('symbol'));
                    });
                    // Ensure left-click starts drawing even over markers
                    marker.addListener("mousedown", (e) => {
                        if (e && e.domEvent && e.domEvent.button === 0) {
                            e.domEvent.preventDefault();
                            this.enableDrawing();
                            this.onStrokeStart?.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
                            this.drawFreeHand(e.latLng);
                        }
                    });

                    // Store as an asset associated with this feature
                    let poid = feature.getProperty('symbol').poid;
                    if (!this.#assets.has(poid)) {
                        this.#assets.set(poid, [marker]);
                    }
                    else {
                        this.#assets.get(poid).push(marker);
                    }
                }
                // Hide the standard marker that google wants to display when it sees a point
                return { visible: feature.getGeometry().getType() != 'Point', cursor: 'default' };
            }
            return { visible: true, cursor: 'default' };
        });

        // Feature selection via right-click and left-click drawing even over features
        this.#map.data.addListener('mousedown', (event) => {
            if (event && event.domEvent) {
                const btn = event.domEvent.button;
                if (btn === 2) {
                    // Right-click selection
                    this.onSelection?.call(this, event.feature.getProperty('symbol'));
                } else if (btn === 0) {
                    // Left-click drawing
                    event.domEvent.preventDefault();
                    this.enableDrawing();
                    this.onStrokeStart?.call(this, { lat: event.latLng.lat(), lon: event.latLng.lng() }, this.getIsoTimestamp());
                    this.drawFreeHand(event.latLng);
                }
            }
        });


        // Start sketch capture on left mouse down anywhere on the map
        this.#map.addListener('mousedown', (e) => {
            // Only left button
            if (e && e.domEvent && e.domEvent.button !== 0) {
                return;
            }
            // Allow panning with Ctrl
            if (e.domEvent && e.domEvent.ctrlKey) {
                return false;
            }
            e.domEvent && e.domEvent.preventDefault();
            this.enableDrawing();
            this.onStrokeStart?.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
            this.drawFreeHand(e.latLng);
        });
    }
    //#endregion

    //#region Sketching
    /**
     * Set drawing mode and collect the freehand coordinates until a pen up
     * @param {*} latLng Coordinate of the initial (pendown) point
     */
    drawFreeHand = (latLng) => {
        // Capture start time
        this.#strokeStart = this.getIsoTimestamp();

        // Clear last stroke, if any
        this.clearInk();

        // Create a new stroke object and load the initial coords
        this.#strokePoly = new google.maps.Polyline({
            map: this.#map,
            clickable: false,
            strokeColor: '#8B0000',
            strokeWeight: 2,
        });
        this.#strokePoly.getPath().push(latLng);

        // Add segments as the mouse is moved, preserving listener
        this.#moveListener = google.maps.event.addListener(this.#map, 'mousemove', (e) => {
            this.#strokePoly.getPath().push(e.latLng);
        });

        // End the stroke on mouse up (map or anywhere in document)
        let finished = false;
        const finishStroke = () => {
            if (finished) return;
            finished = true;
            this.#strokeEnd = this.getIsoTimestamp();
            if (this.#moveListener) {
                google.maps.event.removeListener(this.#moveListener);
                this.#moveListener = undefined;
            }
            this.enableDragZoom();

            let path = this.#strokePoly.getPath();
            if (path.getLength() == 1) path.push(path.getAt(0));
            let strokeLatLng = path.getArray().map(item => ({ lat: item.lat(), lon: item.lng() }));

            let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
            let mapBounds = this.#map.getBounds();
            if (!mapBounds) {
                throw new Error("Failed to retrieve the #map bounds - unable to send ink to STP");
            }
            this.onStrokeCompleted?.call(
                this,
                { width: sizePixels.width, height: sizePixels.height },
                { lat: mapBounds.getNorthEast().lat(), lon: mapBounds.getSouthWest().lng() },
                { lat: mapBounds.getSouthWest().lat(), lon: mapBounds.getNorthEast().lng() },
                strokeLatLng,
                this.#strokeStart,
                this.#strokeEnd,
                []
            );
        };
        google.maps.event.addListenerOnce(this.#map, 'mouseup', finishStroke);
        // Fallback in case mouseup occurs on a marker or outside the map
        document.addEventListener('mouseup', finishStroke, { once: true });
    }

    /**
     * Set #map controls so that the mouse can be used to freehand draw
     */
    enableDrawing = () => {
        this.#map.setOptions({
            draggable: false,
            zoomControl: false,
            scrollwheel: false,
            disableDoubleClickZoom: false
        });
    }

    /**
     * Restore the standard drag/zomm capabilities
     */
    enableDragZoom = () => {
        this.#map.setOptions({
            draggable: true,
            zoomControl: true,
            scrollwheel: true,
            disableDoubleClickZoom: true
        });
    }
    //#endregion 

    //#region Feature handling
    /**
     * Add GeoJSON feature to the #map
     * @param symbol - Symbol GeoJSON to add as a feature
     */
    addFeature = (symbolGeoJSON) => {
        if (symbolGeoJSON) {
            this.#map.data.addGeoJson(symbolGeoJSON);
        }
    }

    /**
     * Remove GeoJSON feature from #map
     * @param poid - Unique identifier of the feature to remove
     */
    removeFeature = (poid) => {
        let feature = this.#map?.data.getFeatureById(poid);
        if (feature) {
            // Remove associated #assets, if any
            if (this.#assets.has(poid)) {
                let markers = this.#assets.get(poid);
                for (let i = 0; i < markers.length; i++) {
                    markers[i].setMap(null);
                }
            }
            this.#map.data.remove(feature);
        }
    }

    /**
     * Add a polyline to the map
     * @param coords 
     * @param color 
     * @param weight 
     * @returns 
     */
    addPoly = (coords, color = '#66cc00', weight = 2) => {
        if (!coords || coords.length === 0) {
            return;
        }
        // If single point, add it again to get a zero-length line
        if (coords.length === 1) {
            coords.push(coords[0]);
            weight *= 2;
        }
        // Create a new poly object
        let poly = new google.maps.Polyline({
            map: this.#map,
            path: coords.map(c => ({lat: c.lat, lng: c.lon})),
            clickable: false,
            strokeColor: color,
            strokeWeight: weight,
        });
    }

    /**
     * Get the current #map bound coordinates
     */
    getBounds = () => {
        return this.#map.getBounds();
    }

    /**
     * Display an information window/popup on the #map
     * @param content HTML content to display
     * @param location Coordinates of the location where the content is to be displayed
     * @param handlers Optional array of CSS selectors and corresponding functions to activate if the element is selected (button/link clicked)
     */
    displayInfo = (content, location, handlers) => {
        let node = document.createElement('div');
        node.innerHTML = content;

        // Set the symbol info to be displayed at the symbol's centroid
        let centroid = { lat: location.lat, lng: location.lon };
        let infoWindow = new google.maps.InfoWindow({
            content: node,
            position: centroid,
        });

        // Hook event handlers to elements of the info window, if any were provided
        if (infoWindow && handlers && handlers.length) {
            for (let i = 0; i < handlers.length; i++) {
                let instance = node.querySelector(handlers[i].selector);
                if (instance && handlers[i].handler) {
                    google.maps.event.addDomListener(instance, 'click', (event) => {
                        if (handlers[i].closeInfo) {
                            infoWindow.close();
                        };
                        handlers[i].handler(event);
                    });
                }
            }
        }
        infoWindow.open(this.#map);
    }

    /**
     * Remove last stroke from the #map if one exists
     */
    clearInk = ()  => {
        this.#strokePoly?.setMap(null);
    }
    //#endregion
    //#region Utility
    /**
     * Current time in ISO 8601 format
     * @return ISO-8601 string
     */
    getIsoTimestamp = () => {
        let timestamp = new Date();
        return timestamp.toISOString();
    }
}

// Expose to browser global for script-tag consumers
if (typeof window !== 'undefined') {
    window.GoogleMap = GoogleMap;
}
