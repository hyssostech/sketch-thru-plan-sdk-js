import { LatLon, Size, StpSymbol } from "sketch-thru-plan-sdk";
import { BasicRenderer, IGeoSvg } from "./basicrenderer";

/**
 * 
 */
type InfoHandlers = { selector: string, handler: (event: Event) => void, closeInfo: boolean };

interface IStpMap {
    /**
     * Add feature representing a symbol to the map
     * @param symbol Symbol GeoJSON to add
     */
    addFeature(symbolGeoJSON: GeoJSON.Feature): void;
    /**
     * Remove a feature from the map
     * @param poid Unique identifier of the feature to remove
     */
    removeFeature(poid: string): void;
    /**
     * Remove gesture ink from the map, if any
     */
    clearInk(): void;
    /**
     * Get current map bounds
     */
    getBounds(): google.maps.LatLngBounds;
    /**
     * Display an information window/popup on the map
     * @param content HTML content to display
     * @param location Coordinates of the location where the content is to be displayed
     * @param handlers Optional array of CSS selectors and corresponding functions to activate if the element is selected (button/link clicked)
     */
    displayInfo(content: string, location: LatLon, handlers: InfoHandlers[]): void;

    /**
     * Event invoked when a stroke is just started
     */
    onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
    /**
     * Optional event invoked when a stroke has been completed
     */
    onStrokeCompleted: ((
        pixelBoundsWindow: Size,
        topLeftGeoMap: LatLon,
        bottomRightGeoMap: LatLon,
        strokePoints: LatLon[],
        timeStrokeStart: string,
        timeStrokeEnd: string,
        intersectedPoids: string[]
    ) => void) | undefined;
    /**
     * Event invoked when a feature is selected
     */
    onSelection: ((symbol: StpSymbol) => void) | undefined;
}
/**
 * Sketch collection and feature display on Google Maps
 * // Adapted from https://stackoverflow.com/a/22808047
 */
export class GoogleMap implements IStpMap {
    //#region Events 
    onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
    onStrokeCompleted: ((
        pixelBoundsWindow: Size,
        topLeftGeoMap: LatLon,
        bottomRightGeoMap: LatLon,
        strokePoints: LatLon[],
        timeStrokeStart: string,
        timeStrokeEnd: string,
        intersectedPoids: string[]
    ) => void) | undefined;
    onSelection: ((symbol: StpSymbol) => void) | undefined;
    //#endregion Events
    //#region Properties
    apiKey: string;
    mapDivId: string;
    map: google.maps.Map | undefined;
    mapCenter: LatLon;
    zoomLevel: number;

    strokeStart: string;
    strokeEnd: string;
    strokePoly: google.maps.Polyline | undefined;
    moveListener: google.maps.MapsEventListener | undefined;

    assets: Map<string, Array<google.maps.Marker>>;
    //#endregion
    
    //#region Construction and initialization
    /**
     * Construct a Google Maps object
     * @param apiKey API key to use
     * @param mapDivId Id of the HTML div where map is presented
     * @param mapCenter Coordinates of the center of the map region displayed on load
     * @param zoomLevel Zoom level of the map region displayed on load
     */
    constructor(apiKey: string, mapDivId: string, mapCenter: LatLon, zoomLevel: number) {
        this.apiKey = apiKey;
        this.mapDivId = mapDivId;
        this.mapCenter = mapCenter;
        this.zoomLevel = zoomLevel;

        // Initialize sketched ink structures
        this.strokeStart = this.strokeEnd = '';

        // Add structure to track markers added to features
        this.assets = new Map();
    }

    /**
     * Insert the google maps script to the html, linking to our initialization callback
     */
    async load() {
        const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + this.apiKey;
        if (!document.querySelectorAll('[src="' + googleMapsUrl + '"]').length) {
            document.body.appendChild(Object.assign(
                document.createElement('script'), {
                type: 'text/javascript',
                src: googleMapsUrl,
                onload: async () => await this.initMap()
            }));
        } else {
            await this.initMap();
        }
    }

    /**
     * Initialize google maps and the STP SDK, setting up the stroke capture events
     * THe standard mode is drawing/sketching - users need to hold the Ctrl key to be able to use the mouse
     * in a conventional (drag) way
     */
    async initMap() {
        // Load map
        const mapDiv = document.getElementById(this.mapDivId);
        if (!mapDiv) {
            throw new Error("Html page must contain a 'map' div");
        }
        this.map = new google.maps.Map(
            mapDiv,
            {
                zoom: this.zoomLevel,
                center: { lat: this.mapCenter.lat, lng: this.mapCenter.lon },
                gestureHandling: 'cooperative',
                draggable: true,
                draggableCursor: 'crosshair'
            });

        // Set the styling of the geojson data layer, processing features with associated additional svg rendering
        this.map.data.setStyle((feature) => {
            let rend: IGeoSvg[] | null = feature.getProperty('rendering');
            if (rend) {
                for (let i: number = 0; i < rend.length; i++) {
                    let shape = rend[i].shape.map(item => { return [item.x, item.y]; }).flat();
                    let marker = new google.maps.Marker({
                        map: this.map,
                        icon: {
                            url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                            anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                        },
                        shape: {
                            type: 'poly',
                            coords: shape as google.maps.MarkerShapePolyCoords
                        },
                        position: { lat: rend[i].position.lat, lng: rend[i].position.lon },
                    });
                    if (rend[i].title) {
                        marker.setTitle(rend[i].title);
                    }
                    // Advertise selection event
                    marker.addListener("click", () => {
                        this.onSelection?.call(this, feature.getProperty('symbol'));
                    });

                    // Store as an asset associated with this feature
                    let poid: string = feature.getProperty('symbol').poid;
                    if (!this.assets.has(poid)) {
                        this.assets.set(poid, [marker]);
                    }
                    else {
                        this.assets.get(poid)!.push(marker);
                    }
                }
                // Hide the standard marker that google wants to display when it sees a point
                return { visible: feature.getGeometry().getType() != 'Point' };
            }
            return { visible: true };
        });

        // Advertise feature selection
        this.map.data.addListener('click', (event) => {
            // Hook up selection event
            this.onSelection?.call(this, event.feature.getProperty('symbol'));
        });


        // Set events to start sketch capture on mouse down
        this.map.addListener('mousedown', (e) => {
            // Skip if ctrl key is pressed - let user pan on drag 
            if (e.domEvent.ctrlKey) {
                return false;
            }
            // Set drawing friendly event handling
            e.domEvent.preventDefault();
            this.enableDrawing();

            // Hand over to STP for processing
            this.onStrokeStart?.call(this, new LatLon(e.latLng.lat(), e.latLng.lng()), this.getIsoTimestamp());

            // Capture the freehand sketch - pass in the initial coord to support single point clicks
            this.drawFreeHand(e.latLng);
        });
    }
    //#endregion

    //#region Sketching
    /**
     * Set drawing mode and collect the freehand coordinates until a pen up
     * @param {*} latLng Coordinate of the initial (pendown) point
     */
    private drawFreeHand(latLng: google.maps.LatLng) {
        // Capture start time
        this.strokeStart = this.getIsoTimestamp();

        // Clear last stroke, if any
        this.clearInk();

        // Create a new stroke object and load the initial coords
        this.strokePoly = new google.maps.Polyline({
            map: this.map,
            clickable: false,
            strokeColor: '#8B0000',
            strokeWeight: 2,
        });
        this.strokePoly.getPath().push(latLng);

        // Add segments as the mouse is moved, preserving listener
        this.moveListener = google.maps.event.addListener(this.map!, 'mousemove', (e) => {
            this.strokePoly!.getPath().push(e.latLng);
        });

        // End the stroke on mouse up
        google.maps.event.addListenerOnce(this.map!, 'mouseup', (e) => {
            // Capture end time
            this.strokeEnd = this.getIsoTimestamp();

            // Clear the drawing events
            if (this.moveListener) {
                google.maps.event.removeListener(this.moveListener);
            }
            this.enableDragZoom();

            // Get the path, adding the initial point twice if there is just a single point (a click)
            // so we have a valid zero-length segment that will show as a dot 
            let path = this.strokePoly!.getPath();
            if (path.getLength() == 1)
                path.push(path.getAt(0));

            // Convert to array
            let strokeLatLng = path.getArray().map(item => { let o = new LatLon(item.lat(), item.lng()); return o; });

            // Notify STP of the new ink stroke
            let sizePixels = { width: document.getElementById('map')!.clientWidth, height: document.getElementById('map')!.clientHeight };
            let mapBounds = this.map!.getBounds();
            if (!mapBounds) {
                throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
            }
            if (this.onStrokeCompleted) {
                this.onStrokeCompleted(
                    new Size(sizePixels.width, sizePixels.height),
                    new LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()),
                    new LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()),
                    strokeLatLng,
                    this.strokeStart,
                    this.strokeEnd,
                    [] // intersectedPoids
                );
            }
        });
    }

    /**
     * Set map controls so that the mouse can be used to freehand draw
     */
    private enableDrawing() {
        this.map!.setOptions({
            draggable: false,
            zoomControl: false,
            scrollwheel: false,
            disableDoubleClickZoom: false
        });
    }

    /**
     * Restore the standard drag/zomm capabilities
     */
    private enableDragZoom() {
        this.map!.setOptions({
            draggable: true,
            zoomControl: true,
            scrollwheel: true,
            disableDoubleClickZoom: true
        });
    }
    //#endregion 

    //#region Feature handling
    /**
     * Add feature to the map
     * @param symbol - Military symbol to add as a feature
     */
    addFeature(symbolGeoJSON: GeoJSON.Feature) {
        if (symbolGeoJSON) {
            this.map!.data.addGeoJson(symbolGeoJSON);
        }
    }

    /**
     * Remove a feature from the map
     * @param poid Unique identifier of the feature to remove
     */
    removeFeature(poid: string) {
        let feature = this.map!.data.getFeatureById(poid);
        if (feature) {
            // Remove associated assets, if any
            if (this.assets.has(poid)) {
                let markers: google.maps.Marker[] = this.assets.get(poid)!;
                for (let i: number = 0; i < markers.length; i++) {
                    markers[i].setMap(null);
                }
            }
            this.map!.data.remove(feature);
        }
    }
    //#endregion

    //#region Display related functions
    /**
     * Display an information window/popup on the map
     * @param content HTML content to display
     * @param location Coordinates of the location where the content is to be displayed
     * @param handlers Optional array of CSS selectors and corresponding functions to activate if the element is selected (button/link clicked)
     */
    displayInfo(content: string, location: LatLon, handlers: { selector: string; handler: (event: Event) => void, closeInfo:boolean}[]): void {
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
            for (let i: number = 0; i < handlers.length; i++) {
                let instance = node.querySelector(handlers[i].selector)!;
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
        infoWindow.open(this.map);
    }

    /**
     * Remove last stroke from the map if one exists
     */
    clearInk(): void {
        this.strokePoly?.setMap(null);
    }

    /**
     * Get the current map bound coordinates
     */
    getBounds(): google.maps.LatLngBounds {
        return this.map.getBounds();
    }
    //#endregion

    //#region Utility
    /**
     * Current time in ISO 8601 format
     * @return ISO-8601 string
     */
    getIsoTimestamp() {
        let timestamp = new Date();
        return timestamp.toISOString();
    }
    //#endregion
}
