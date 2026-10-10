/**
 * Rules of engagement values the engine accepts for {@link StpC2SIMOptions.rulesOfEngagement}:
 * the members of its ROE enum, matched case-sensitively (STP-694)
 */
export type StpC2SIMRulesOfEngagement = 'Hold' | 'Free' | 'Tight';

/** 
 * C2SIM generation options
 *
 * The field names are the option keys sent on the wire, and are the property names the
 * OpenRPC contract (json-api/sketch-thru-plan-api.json) enumerates for the C2SIM methods'
 * `options`. The engine matches keys case-insensitively, but a strict JSON Schema validator
 * does not, so the two must stay spelled alike (STP-694)
*/
export class StpC2SIMOptions {
    /**
     * Full C2SIM server endpoint, including host:port/path, e.g. "http://10.2.10.30:8080/C2SIMServer</param>
     */
    restUrl: string | undefined;

    /**
     * C2SIM REST endpoint password
     */
    restPassword: string | undefined;

    /**
     * Full STOMP service endpoint, including host:port/destination, e.g. "http://10.2.10.30:61613/topic/C2SIM"</param>
     */
    stompUrl: string | undefined;

    /**
     * Server protocol version: "1.0.0", "1.0.1", "1.0.2"
     */
    serverProtocol: string | undefined;

    /**
     * value of the <SystemEntityList>/<SystemName> element included in the C2SIM Initialization document
     */
    systemName: string | undefined;

    /**
     * Force a C2SIM server state transition to Uninitialized before pushing Initialization.
     * Used to clear up the state to clear previous initializations - if not used, Initialization 
     * may be merged with previous ones
     */
    resetBeforeInitialize: boolean | undefined;

    /**
     * Force a C2SIM server state transition to Running right after pushing Initialization
     * This is just required if interfaces that can only be started after the Initialization is shared are used
     * One example is the VRF interface 2.16
     */
    runAfterInitialize: boolean | undefined;

    /**
     * Include the full TO (and all TG) in the Initialization and Order document. If false, just the elements that are placed in the map (and their subordinates) are included 
     */
    fullTO: boolean | undefined;

    /**
     * Use the older version of the C2SIM schema - v1.0.0 - for compatibility with existing tooling
     */
    schemaVersion: string | undefined;

    /**
     * Add TGs that are not included in any Task as MapGraphicID elements in the Initialization document
     */
    addOrphanTgToInitialization: boolean | undefined;

    /**
     * Place Task TGs  MapGraphicID elements in the Initialization documents, rather than the Orders
     */
    placeAllTgInInitialization: boolean | undefined;

    /**
     * Include MapGraphicID references to tactical graphics in tasks, rather than relying on Location
     */
    includeMapGraphicId: boolean | undefined;

    /**
     * Maximum number of character for generate entitiy names - VRF Interface restriction - 0 for none 
     */
    entityNameCharLimit: number | undefined;

    /**
     * Append the description to generated entity names - required to round-trip an ORBAT
     * imported from C2SIM documents
     */
    includeDescriptionInName: boolean | undefined;

    /**
     * Default rules of engagement: `'Hold'`, `'Free'` or `'Tight'`, the engine's values
     *
     * `'ROEHold'`, `'ROEFree'` and `'ROETight'` are deprecated: they were this SDK's spelling
     * before 0.6.17, which the engine never accepted (it ignored them and kept its configured
     * default). The SDK now sends them as `'Hold'`, `'Free'` and `'Tight'`; use those instead
     */
    rulesOfEngagement: StpC2SIMRulesOfEngagement | 'ROEHold' | 'ROEFree' | 'ROETight' | undefined;
    
    /**
     * Use Position Report information to update units
     */
    updateUnitPositions: boolean | undefined;

    /**
     * Folder to write export json file to.
     */
    exportFileDir: string | undefined;

    /**
     * Path to a schema file to validate generated XML against; empty for no validation
     */
    validationSchema: string | undefined;

    /**
     * Mission start date
     */
    startDate: Date | undefined;

    /**
     *Amount of minutes each STP phase takes
        */
    phaseDuration: number | undefined;

    /**
     * Sender unique id - defaults to "00000000-0000-0001-0001-000000000000"
     */
    fromSenderUUID: string | undefined;

    /**
     * Receiver unique id - defaults to "00000000-0007-0001-0000-000000000000"
     */
    toReceiverUUID: string | undefined;

    /**
     * Friendly forces name
     */
    friendFstName: string | undefined;

    /**
     * Friendly forces unique id - defaults to "00000000-0000-0001-0000-000000000000"
     */
    friendFstUUID: string | undefined;

    /**
     * Hostile forces name
     */
    hostileFstName: string | undefined;

    /**
     * Hostile forces unique id - defaults to "00000000-0000-0002-0000-000000000000"
     */
    hostileFstUUID: string | undefined;

    /**
     *Neutral forces name
        */
     neutralFstName: string | undefined;

    /**
     *Neutral forces unique id - defaults to "00000000-0000-0003-0000-000000000000"
        */
     neutralFstUUID: string | undefined;

     /**
     * Unknown forces name
     */
     unknownFstName: string | undefined;
    
     /**
     * Unknown forces unique id - defaults to "00000000-0000-0004-0000-000000000000"
     */
     unknownFstUUID: string | undefined;
    }

export default StpC2SIMOptions;
