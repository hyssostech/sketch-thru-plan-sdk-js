/**
 * Bare renderer, which shows simple geometric shapes to represent single point symbols, and lines to represent multipoint TG
 */
class BasicRenderer {
    symbol;
    size;

    /**
     * 
     * @param symbol STP symbol to render
     * @param pointSize Size in pixels of Point symbols (units, equipment, mootw, point TG)
     */
    constructor(symbol, pointSize = 50) {
        this.symbol = symbol;
        this.size = pointSize;
    }

    /**
     * Symbol rendering as GeoJSON
     */
    asGeoJSON() {
        // Load the simple JSON representation that is provided by the SDK itself, which represents just the anchor points
        let res =  this.symbol.asGeoJSON();

        // The anchor points are ordered in such a way that there is sometimes no match with the original gesture
        // Patch the geometry to make it match better from a visual standpoint
        let gesture = this.getGestureGeometry(this.symbol);
        res.geometry = gesture;

        // Add SVG rendering, if applicable
        let svgRendering = this.asSVG();
        if (svgRendering) {
            res.properties.rendering = svgRendering;
        }
        return res;
    }

    /**
     * Symbol rendering as SVG, if available
     */
    asSVG() {
        if (this.symbol.location?.fsTYPE == 'point') {
            let gsvg = [ this.pointSVG(this.symbol) ];
            return gsvg;
        }
        else {
            // No SVG representation for multipoint in the minimal renderer
            return null;
        }
    }
    
    /**
     * Build the GeoJSON Geometry for a symbol
     * @param symbol Symbol for which geometry is desired
     */
    getGestureGeometry(symbol) {
        if (symbol.location == undefined || symbol.location == null || symbol.location.coords == undefined || symbol.location.coords.length == 0 || symbol.location.centroid == undefined) {
            throw new Error('Symbol does not have location information');
        }
        let res;
        let geoType;
        //let geoCoordinates: GeoJSON.Position[] ;
        let geoCoordinates;
        if (symbol.location.shape == "point") {
            res = {
                type: "Point",
                coordinates: [ symbol.location.centroid.lon, symbol.location.centroid.lat ] // Position ([lon,lat])
            }
        }
        else {
            // Most symbols are lines, as-is, so set that as the default
            // shape: line, straightline, arrowthin, *hook*
            // Areas are treated as lines as well to avoid having a clickable area that covers the whole polygon
            res = this.toLineString(symbol.location.coords);
            // Override as needed
            if (symbol.location?.shape != null && symbol.location?.shape.includes("arrowfat")) {
                // Coordinates 1 to n-1 need to be reversed, then the "n" (width) needs to be added
                let reorderedLatLon = symbol.location.coords.slice(0, symbol.location.coords.length - 1).reverse();
                reorderedLatLon.push(symbol.location.coords[symbol.location.coords.length - 1]);
                res = this.toLineString(reorderedLatLon);
            } else if (symbol.location?.shape == "ubend") {
                let reorderedLatLon = [ symbol.location.coords[0], symbol.location.coords[2], symbol.location.coords[3], symbol.location.coords[1] ];
                res = this.toLineString(reorderedLatLon);
            } else if (symbol.location?.shape == "ubendthreepoints") {
                // Create a fake 4th point aligned with point 2, then create an ordered line
                //     3         1
                //     +--------->
                //     |         
                //     |         
                //     +--------->  
                //     4th?      2      
                let fourthPt = new LatLon(symbol.location.coords[1].lat, symbol.location.coords[2].lon);
                let reorderedLatLon = [ symbol.location.coords[0], symbol.location.coords[2], fourthPt, symbol.location.coords[1] ];
                res = this.toLineString(reorderedLatLon);
            } else if (symbol.location?.shape == "vee") {
                let reorderedLatLon = [ symbol.location.coords[1], symbol.location.coords[0], symbol.location.coords[2] ];
                res = this.toLineString(reorderedLatLon);
            } else if (symbol.location?.shape == "opencircle") {
                // Represent as line connecting center to the start of the stroke
                // TODO: consider generating a polygon approximation
                //// Approximate a circular arch starting in p2, and leaving a gap
                //// TODO: this generates a flatish ellipse rather than a circle
                //Latlon center = location.coords[0];
                //Latlon p2 = location.coords[1];
                //double radius = haversine(center.lat, center.lon, p2.lat, p2.lon);
                //double rho = radius / 6371; // Earth radius in km
                //const double slice = 2 * Math.PI / 20.0;
                //for (double theta = 0.0; theta <= 2 * Math.PI - slice; theta += slice)
                //{
                //    // asin(sin lat_O ⋅ cos δ + cos lat_O ⋅ sin δ ⋅ cos θ)
                //    double lat = Math.Asin(Math.Sin(center.lat) * Math.Cos(rho) + Math.Cos(center.lat) * Math.Sin(rho) * Math.Cos(theta));
                //    // lon_O + atan((sin θ ⋅ sin δ ⋅ cos lat_O) / (cos δ − sin lat_O ⋅ sin lat_P2))
                //    double lon = center.lon + Math.Atan((Math.Sin(theta) * Math.Sin(rho) * Math.Cos(center.lat)) / (Math.Cos(rho) - Math.Sin(center.lat) * Math.Sin(p2.lat)));
                //    //g.Coordinates.Add(new Latlon(lat, lon));
                //    Console.Write(",[" + lon + "," + lat + "]");
                //}
            } else if (symbol.location?.shape == "multipoint") {
                // All multipoint symbols are approximated to Lines by Pro
                res = {
                    type: "MultiPoint",
                    coordinates:symbol.location.coords.map((item) => [item.lon, item.lat]) // Position[] ([ [lon,lat], [lon,lat], ...])
                }
                /*
                // Multipoint are custom - need to deal with each of them individually
                if (new Regex("G.(M.BCB).*").IsMatch(item.symbol_id)) // Bridge - could approximate with Ubend3pt, since lines are parallel
                {
                    lineDirection = Utility.LineDirection.Reversed;
                    //  \1__________2/
                    //   ____________
                    //  /3          4\
                    // Calculate the Utility.MidLine between the two sides - Pretend this is a Ubend
                }
                else if (new Regex("G.(M.OEB|T.B).*").IsMatch(item.symbol_id)) // Block - could handle with Ubend3pt, since the vertix is the last coord
                {
                    //               1
                    // 3-------------|
                    //               2
                }
                else if (new Regex("G.(M.OED|T.T).*").IsMatch(item.symbol_id)) // Disrupt
                {
                    //     1         3
                    //     +--------->
                    //     |         
                    //   --M-------> .
                    //     |         M'
                    //     +----->  
                    //     2        
                }
                else if (new Regex("G.(M.OET).*").IsMatch(item.symbol_id)) // Turn
                {
                    // Curved line, with Point 1 an 2 coords at the beginning and end, and Point 3 "define the 90 degree arc"
                }
                else if (new Regex("G.(T.P).*").IsMatch(item.symbol_id)) // Penetrate - could handle with Ubend3pt, since the vertix is the last coord
                {
                    //               1
                    // 3------------>|
                    //               2
                }
                else if (new Regex("G.(T.Z).*").IsMatch(item.symbol_id)) // Seize
                {
                    // Curved line with a circle at the beginning
                    // If 4 points are available:
                    // Point 1 defines the center of the circle. Point 2 defines the radius of the circle. 
                    // Point 3 defines the curvature of the arc. 
                    // Point 4 defines the end of the arrow. 
                    // Approximate by just considering the 1-4 line
                    //
                    // If 3 points are available:
                    // Point 1 defines the center point of the circle. 
                    // Point 2 defines the tip of the arrowhead. 
                    // Point 3 defines the 90 degree arc
                }
               */
            }
        }
        return res;
    }

    /**
     * Generate SVG rendering for point symbols (units, mootw, equipment, single point TG)
     * @param symbol 
     */
    pointSVG(symbol)
    {
        if (symbol.location == undefined || symbol.location == null || symbol.location.centroid == undefined) {
            throw new Error('Point symbol does not have a defined centroid');
        }
        let command;
        let properties;
        let fillColor;
        let width;
        let height;
        let strokeColor = "black";
        let strokeWidth = 1;
        let rotation = 0;
        let transform = '';

        // Scaling required for a square of a given size w to fit when rotated 45 degrees
        // Used also to get smaller sizes for other non-friendly icons
        const scaling = 1.42;

        if (symbol.affiliation === "friend") {
            // Generic blue rectangle for friendly forces
            width = this.size - 2 * strokeWidth;
            height = this.size / scaling - 2 * strokeWidth;
            command = 'rect';
            properties = 'width="' + width + '" ' +
                    'height="' + height + '" ';
            fillColor = "#80e0ff";
        }
        else if (symbol.affiliation === "hostile") {
            // Generic red lozenge for hostile forces
            let side = this.size / scaling - 2 * strokeWidth;
            // Since the square is rotated, make sure the sides are such that the diagonal fits within the scaled dimension
            // height^2 = side^2 + side^2 => height^2 = 2 . side^2 => height = Sqrt(2 . side^2) = Sqrt(2) . side
            width = height = side * Math.SQRT2;
            command = 'rect';
            properties =  'width="' + side + '" ' +
                    'height="' + side + '" ';
            fillColor = "#ff8080";
            rotation = 45;
            transform = 'transform="translate(' + width / 2 + ' 0) rotate(' + rotation + ')" ';
        }
        else if (symbol.affiliation === "neutral") {
            // Green square
            width = height = this.size / scaling - 2 * strokeWidth;
            command = 'rect';
            properties = 'width="' + width + '" ' +
                    'height="' + height + '" ';
            fillColor = "#aaffaa";
        }
        else {
            // Generic  circle for  other affiliations (unknown)
            width = height = this.size / scaling - 2 * strokeWidth;
            command = 'circle';
            properties =  'cx="' + width / 2 + '" ' +
                    'cy="' + height / 2 + '" ' +
                    'r="' + width / 2 + '" ';
            fillColor = "#ffff80";
        }
        // Assemble the svg
        let svg = 
            '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" ' +
                'width="' + width +  '" ' +
                'height="' + height + '" ' +
                'viewBox="0 0 ' + width + ' ' + height + '" ' +
            '> ' +
                '<' + command + ' ' + properties + ' ' +
                    'stroke="' + strokeColor + '" ' +
                    'stoke-width="' + strokeWidth + '" ' +
                    'fill="' + fillColor + '" ' +
                    transform + 
                '/>' +
            '</svg>';
        // Calculate the boundaries of the core clickable region
        let shape;
        if (rotation > 0) {
            const matrix = this.getTransform(svg, command);
            //[
            //    /*a*/Math.cos(rotation * Math.PI / 180.0), /*b*/-Math.sin(rotation * Math.PI / 180.0), 
            //    /*c*/Math.sin(rotation * Math.PI / 180.0), /*d*/Math.cos(rotation * Math.PI / 180.0), 
            //    /*e*/width / 2,  /*f*/0.0
            //]; 
            // Icon's corners, clockwise (if a circle, its bounding box's)
            shape = [
                this.applyTransform(matrix, {x:0, y:0}),
                this.applyTransform(matrix, {x:width, y:0}),
                this.applyTransform(matrix, {x:width, y:height}),
                this.applyTransform(matrix, {x:0, y:height}),
            ];
        }
        else {
            // Non-transformed corners, clockwise (if a circle, its bounding box's)
            shape = [
                {x:0, y:0},
                {x:width, y:0},
                {x:width, y:height},
                {x:0, y:height},
            ];
        }
        // Pack the result
        let res =  {
            type: 'icon',
            title: symbol.description,
            topLeft: symbol.location.centroid,
            bottomRight: symbol.location.centroid,
            position: symbol.location.centroid,
            svg: btoa(svg),
            shape: shape,
            anchor: {x:width/2, y:height/2}
        };
        return res;
    }

    /**
     * Get the transform matrix of a SVG shape element
     * @param svg SVG definition embedding the shape one wants to get the transform from
     * @param selector The shape to get the transform from
     * @returns The shape transform or the identity matrix if one is not available
     */
    getTransform(svg, selector) {
        // Create hidden div to house the element being measured
        let tempDiv = document.createElement('div')
        document.body.appendChild(tempDiv);
        // Change visibility _after_ adding to document, otherwise getCMT() will return null
        tempDiv.setAttribute('style', "position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0")
        // Child svg - set to the parameter contents
        tempDiv.insertAdjacentHTML( 'beforeend', svg);
        // Retrieve the desired shape element and extract it's transform matrix
        let svgEl = tempDiv.querySelector(selector);
        let matrix =  svgEl?.getCTM();
        // Clean up
        document.body.removeChild(tempDiv);
        // Convert to number[] if defined, or return identity
        if (matrix) {
            return [ matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
        }
        else {
            return [1, 0, 0, 1, 0, 0];
        }
    }

    /**
     * Generate a LineString geometry from an array of LatLon
     * @param coords 
     */
    toLineString(coords) {
        let res =  {
            type: "LineString",
            coordinates: coords.map((item) => [item.lon, item.lat]) // Position[] ([ [lon,lat], [lon,lat], ...])
        }
        return res;
    }

    /**
     * Apply transform matrix to a coordinate
     * The matrix, given as a one dimensional vector for convenience is assumed to be
     * a c e
     * b d f
     * 0 0 1
     * @param m Matrix to apply [a:0, b:1, c:2, d:3, e:4, f:5]
     * @param point 
     * @returns transformed coordinates
     */
    applyTransform(m, point) {
        return { x: point.x * m[0] + point.y * m[2] + m[4], y: point.x * m[1] + point.y * m[3] + m[5] };
    }
}