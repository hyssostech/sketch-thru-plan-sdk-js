# Rendering plugins

Provides generic rendering capabilities for military symbology, supporting multiple rendering engines.
 
 Two renderer variants are implemented:
 
 1. **JmsRenderer (milsymjs)**: Combines Spatial Illusions milsymbol for single‑point SVG icons with the legacy Mission Command multipoint renderer to produce high‑fidelity GeoJSON for tactical graphics, plus enriched label overlays and anchors.

 2. **MilsymTsRenderer (milsymts)**: Uses Mission Command’s modern TypeScript WebRenderer to generate multipoint GeoJSON for MIL-STD-2525D and MIL-STD-2525E symbols. Points are returned as GeoJSON without SVG overlays.

 ## Developing a new renderer

All renderers implement a common contract so clients can swap implementations transparently.

Interface: see [interfaces/IStpRenderer.ts](interfaces/IStpRenderer.ts)

- `asGeoJSON(): any`
   - Returns a GeoJSON Feature or FeatureCollection representing the symbol.
   - Must use `[lon, lat]` coordinate order.
   - Should preserve core STP properties on the returned feature(s) (e.g., `poid`, `sidc`, `fsTYPE`, `affiliation`, `status`, descriptions).
   - May enrich `properties.rendering` with visualization payloads for labels/icons. Typical entries:
      - `type`: `'icon' | 'label'`
      - `position`: `{ lat: number, lon: number }`
      - `svg`: Base64‑encoded SVG string
      - `anchor`: `{ x: number, y: number }` – pixel anchor within SVG
      - `shape`: array of points describing the clickable area (either `{x,y}` objects or `[x,y]` tuples)
   - For complex multipoints, may return a `GeometryCollection` or a `FeatureCollection` of `LineString`/`Polygon` features.

- `asSVG(): Array<any> | null`
   - Optional. Returns SVG renderings and metadata when available (commonly for single‑point symbols).
   - Implementations that do not support SVG should return `null`.

Behavioral notes:
- Error handling: Implementations should throw an error when the symbol lacks sufficient `location` data (coords and centroid).
- Bounds: Some renderers accept map bounds at construction time to compute label placement and geometry segmentation; this is implementation‑specific.
- Properties: Clients can rely on STP’s standard properties listed below for styling/interaction regardless of the renderer used.
 
 STP makes the following properties available by default (but additional ones can be defined). These need to be mapped to specific parameters of the chosen renderer.

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                 |
| poid              | STP unique identifier                                                         |
| parentCoa         | Unique id of the COA this symbol belongs to |
| creatorRole       | Role that created the symbol: S2, S3, S4, Eng, FSO |
| interval          | Symbol creation time interval |
| confidence        | Confidence score of the recognition (1.0 is 100%) |
| alt               | Rank of this symbol interpretation amongst the interpretation hypothesis
| sidc.partA        | Part A of the 2525D id |
| sidc.partB        | Part B of the 2525D id |
| sidc.partC        | Part C of the 2525D id |
| sidc.symbolSet    | 2525D Symbol Set |
| sidc.legacy       | 2525C SIDC |
| location          | Location of the symbol (see sub-properties below) |
| shortDescription  | Just the essential distinguishing elements, e.g. designators |
| description       | Name/type of the symbol plus designators, but may omit "friendly", "present" and other assumed decorators |
| fullDescription   | Complete description, including affiliation, status and all decorators |
| affiliation       | pending, unknown, assumedfriend, friend, neutral, suspected, hostile |
| echelon           | none, team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, armygroup, region, command |
| parent            | Parent unit designator |
| designator1       | Main symbol designator |
| designator2       | Additional designator, e.g. in a company boundary, indicating the designator of the company to the S or E |
| status            | present, anticipated |
| modifier          | HQ and Task Force modifier: none, dummy, hq, dummy_hq, task_force, dummy_task_force, task_force_hq, dummytask_force_hq |
| strength          | none, reduced, reinforced, reduced_reinforced |
| branch            | weapon, ground_unit, civilian_air, special_operations, vstol, equipment, installation, military_air, military_sea, military_submarine |
| timeFrom          | Start time, e.g. of a Restricted Operations Zone |
| timeTo            | End time, e.g. of a Restricted Operations Zone |
| altitude          | Altitude parameter, if applicable |
| minAltitude       | Symbol minimal altitude if a range is supported |
| maxAltitude       | Symbol maximal altitude if a range is supported |
| toUnitPoid        | For symbols created from a Task Org, the unique id of the Task Org Unit that this symbol was created from |


### Location properties:

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Location type: point,line, area |
| width             | Location width, if applicable |
| shpae             | Gesture type, normally point, line or area. Other types include straightline, arrowthin, arrowfat, hook, ubend, ubendthreepoints, vee, opencircle, multipoint see "STP Military Symbol Gestures" documentation for details (available from Hyssos Tech upon request) |
| radius            | Radius of the area containing the symbol, if applicable (zero for point locations) |
| coords            | Array of { lat: latitude, lon: longitude } |
| centroid          | Corrdinates of the location centroid { lat: latitude, lon: longitude } |
| candidatePoids    | Unique Ids of the symbols intersected by "coords". Used for editing operations that use sketches to select objects, for example "move this", "delete this" |

 