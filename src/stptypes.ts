import rewind from './geojson-rewind';

/**
 * Stp message JSON-RPC envelope
 */
export interface StpMessage {
  /**
   * Invoked method name
   */
  method: string;
  /**
   * Method parameters
   */
  params: object;
}

/**
 * Parameters received along a SymbolAdded event
 */
export interface SymbolAddedEvent {
  /**
   * STP symbol that was added
   */
  symbol: StpSymbol;
  /**
   * Indicates if the operation is the result on an undo - in this case of a symbol delete
   */
  isUndo: boolean;
}

/**
 * Speech has been recognized
 */
export interface OnSpeechRecognizedEvent {
  phrases: string[];
}

/**
 * Stp raised message to deliver to user
 */
export interface OnStpMessageEvent {
  message: string;
  level: StpMessageLevel;
}

/**
 * Level of messages raised from STP
 */
export enum StpMessageLevel {
  Error = 'Error',
  Warning = 'Warning',
  Info = 'Info',
  Debug = 'Debug'
}

/**
 * STP roles
 */
export enum StpRole {
  s2 = 'S2',
  s3 = 'S3',
  s4 = 'S4',
  fso = 'FSO',
  eng = 'ENG'
}

/**
 * Listening mode used by {@link StpRecognizer.sendListen}.
 * The engine accepts either the member name (as sent here) or its ordinal:
 * once = 0, on = 1, off = 2.
 */
export enum ListenMode {
  /**
   * Listen until the first period of inactivity is detected, then stop automatically
   */
  Once = 'once',
  /**
   * Keep listening until explicitly told to stop
   */
  On = 'on',
  /**
   * Stop listening
   */
  Off = 'off'
}

/**
 * Common STP properties
 */
export class StpItem {
  /**
   * Type of item: unit | mootw | equipment | tg | task |
   */
  fsTYPE: string | undefined;
  /**
   * STP unique identifier
   */
  poid: string | undefined;
  /**
   * Unique id of the COA this symbol belongs to
   */
  parentCoa: string | undefined;
  /**
   * Role that created the symbol: S2, S3, S4, Eng, FSO
   */
  creatorRole: string | undefined;
  /**
   * Symbol time interval, if any
   */
  interval: Interval | undefined;
  /**
   * Confidence score of the recognition
   */
  confidence: number | undefined;
  /**
   * Alternate index - rank of this symbol interpretation amongst the interpretation hypothesis
   */
  alt: number | undefined;
  /**
   * Open-ended client-defined extension properties.
   * Extensions are roundtripped through STP: set on addSymbol/addTask/etc.,
   * persisted in the STP feature structure layer, and returned on events like
   * onSymbolAdded/onSymbolModified/etc.
   * Values can be primitives, arrays, or nested objects.
   */
  extensions?: Record<string, unknown>;
}
/**
 * STP military symbol
 */
export class StpSymbol extends StpItem {
  /**
   * 2525D and C military ids of this symbol
   */
  sidc: Sidc | undefined;
  /**
   * Computed 2525D symbol identifier: partA+partB when available
   */
  get deltaSIDC(): string | undefined {
    const s = this.sidc;
    if (!s) return undefined;
    // Prefer Sidc getters (work when delta is set)
    if (s.partA && s.partB && s.partC) return `${s.partA}${s.partB}${s.partC}`;
    if (s.partA && s.partB) return `${s.partA}${s.partB}`;
    if (s.partA) return `${s.partA}`;
    if (s.delta) return s.delta;
    return undefined;
  }
  /**
   * Computed 2525C symbol identifier: legacy if available
   */
  get charlieSIDC(): string | undefined {
    const s = this.sidc;
    if (!s) return undefined;
    return s.charlie ?? s.legacy;
  }
  /**
   * Location of the symbol
   */
  location: Location | undefined;

  /**
   * Short symbol description - just the essential distinguishing elements, e.g. designators
   */
  shortDescription: string | undefined;
  /**
   * Regular symbol description - name/type of the symbol plus designators, but may omit "friendly", "present" and other assumed decorators
   */
  description: string | undefined;
  /**
   * Full description of the symbol
   */
  fullDescription: string | undefined;

  /**
   * Symbol affiliation
   */
  affiliation:
    | (
        | 'pending'
        | 'unknown'
        | 'assumed_friend'
        | 'friend'
        | 'neutral'
        | 'suspect'
        | 'hostile'
      )
    | undefined;
  /**
   * Symbol echelon if applicable
   */
  echelon:
    | (
        | 'none'
        | 'team'
        | 'squad'
        | 'section'
        | 'platoon'
        | 'company'
        | 'battalion'
        | 'regiment'
        | 'brigade'
        | 'division'
        | 'corps'
        | 'army'
        | 'army_group'
        | 'region'
        | 'command'
      )
    | undefined;

  /**
   * Parent unit designator
   */
  parent: string | undefined;
  /**
   * Symbol designator
   */
  designator1: string | undefined;
  /**
   * Additional designator, e.g. in a company boundary, indicating the designator of the company to the S or E
   */
  designator2: string | undefined;

  /**
   * Symbol status
   */
  status: ('present' | 'anticipated') | undefined;
  /**
   * HQ and Task Force modifier
   */
  modifier:
    | (
        | 'none'
        | 'feint_dummy'
        | 'hq'
        | 'feint_dummy_hq'
        | 'task_force'
        | 'feint_dummy_task_force'
        | 'task_force_hq'
        | 'feint_dummy_task_force_hq'
        | 'installation'
      )
    | undefined;
  /**
   * Strength modifier
   */
  strength:
    | ('none' | 'reduced' | 'reinforced' | 'reduced_reinforced')
    | undefined;

  /**
   * Branch: equipment, ground_unit, ...
   */
  branch:
    | (
        | 'weapon'
        | 'ground_unit'
        | 'civilian_air'
        | 'special_operations'
        | 'vstol'
        | 'equipment'
        | 'installation'
        | 'military_air'
        | 'military_sea'
        | 'military_submarine'
      )
   | undefined;
  /**
   * Start time, e.g. of a Restricted Operations Zone
   */
  timeFrom: Date | undefined;
  /**
   * End time, e.g. of a Restricted Operations Zone
   */
  timeTo: Date | undefined;

  /**
   * Symbol altitude
   */
  altitude: number | undefined;
  /**
   * Symbol minimal altitude if a range is supported
   */
  minAltitude: number | undefined;
  /**
   * Symbol maximal altitude if a range is supported
   */
  maxAltitude: number | undefined;
  /**
   * For symbols created from a TO, unique id of the Task Org Unit that this symbol was created from
   */
  toUnitPoid: string | undefined;
  /**
   * C2SIM federate this entity is assigned to
   */
  federate: string | undefined; 
  /**
   * C2SIM SISIEntityType - DIS code
   */
  disCode: DISCode | undefined;
  /**
   * C2SIM resources
   */
  resources: Resource[] | undefined;
  /**
   * Symbol's GeoJSON representation
   */
  asGeoJSON(): GeoJSON.Feature<any> {
    if (
      this.location == undefined ||
      this.location.coords == undefined ||
      this.location?.coords.length == 0
    ) {
      throw new Error('Coordinates are undefined or empty');
    }
    let geom: GeoJSON.Geometry;
    // Geometry type may be missing if STP delivered the symbol before filling it out (e.g. a
    // re-add over a stale tombstone). Coordinates are present, so infer a usable type rather than
    // dropping the symbol: a single coordinate is a point, anything else defaults to a line.
    const fsType = this.location.fsTYPE || (this.location.coords.length === 1 ? 'point' : 'line');
    if (fsType === 'point') {
      // Single [,] coordinate
      geom = {
        type: 'Point',
        coordinates: [this.location.coords[0].lon, this.location.coords[0].lat]
      };
    } else if (fsType === 'line') {
      // Array of [,] coordinates
      geom = {
        type: 'LineString',
        coordinates: this.location.coords.map((item) => [item.lon, item.lat])
      };
    } else if (fsType === 'area') {
      // Array of array of [,] coordinates
      geom = {
        type: 'Polygon',
        coordinates: [this.location.coords.map((item) => [item.lon, item.lat])]
      };
      // Make sure that the points are counterclock, as required for Polygons
      geom = rewind(geom, false) as GeoJSON.Geometry;
    } else if (fsType === 'multipoint') {
      // Array of [,] coordinates
      geom = {
        type: 'MultiPoint',
        coordinates: this.location.coords.map((item) => [item.lon, item.lat])
      };
    } else {
      throw new Error(
        'Expected "point", "line", "area", or "multipoint" geometry type. Got: ' +
          fsType
      );
    }
    let symbolGJ: GeoJSON.Feature<any> = {
      type: 'Feature',
      id: this.poid,
      geometry: geom,
      properties: {
        symbol: this
      }
    };
    return symbolGJ;
  }
}

/**
 * STP Task Org (ORBAT) definition - TO units and relationships make reference to this object
 */
export class StpTaskOrg {
  /**
   * Item type
   */
  fsTYPE: 'task_org' | undefined;
  /**
   * STP unique identifier
   */
  poid: string | undefined;
  /**
    Name of the TO, e.g. '3-3'
  */
  name: string | undefined;
  /**
   * Affiliation - friend or hostile
   */
  affiliation:
    | (
      | 'friend'
      | 'hostile'
      )
    | undefined;
  /**
   * Timestamp
   */
  timestamp: string | undefined;
  /**
   * Open-ended client-defined extension properties.
   * Roundtripped through STP feature structures.
   */
  extensions?: Record<string, unknown>;
}

/**
 * STP Task Org (ORBAT) Unit
 */
export class StpTaskOrgUnit extends StpSymbol {
  /**
   * Item type
   */
  fsTYPE: 'task_org_unit' | undefined;
  /**
    Unit name - can be different that the designators, for example "Triple Nickel" for 5/5-5
    Name can be an expression with grouping (parenthesis) alternatives (pipe symbol) and optional (square brackets).
    Example: (ONE | FIRST) [ROYAL] IRISH [GUARDS] [REGIMENT]	
    Accepts these names, amongst others:
      ONE IRISH
      FIRST IRISH
      ONE ROYAL IRISH
      FIRST ROYAL IRISH REGIMENT
      ONE ROYAL ISISH GUARDS REGIMENT
  */
  name: string | undefined;
  /**
   * Speech phrases that can be used to place this TO unit - generated from `name`
   */
  speechPhrases : string[] | undefined;
  /**
   * Function description, such as 'MECHANIZED INFANTRY'
   */
  unitType: string | undefined;
  /**
   * Additional information
   */
  info: string | undefined;
  /**
   * Unique Id of the StpTaskOrg this element belongs to
   */
  parentTO: string | undefined;
}

/**
 * Task Org (ORBAT) relationships
 */
export class StpTaskOrgRelationship {
  /**
   * Type of this item
   */
  fsTYPE: 'task_org_relationship' | undefined;
  /**
   * Unique id
   */
  poid: string | undefined;
  /**
   * Parent Task Org Unit unique id
   */
  parent: string | undefined;
  /**
   * Child Task Org Unit unique id
   */
  child: string | undefined;
  /**
   * Type of relationship between child and parent
   */
  relationship: CommandRelationship | undefined;
  /**
   * Whether this is part of a MTOE (Modificaiton Table of Organization and Equipment)
   */
  isMTOE: boolean | undefined;
  /**
   * Unique Id of the StpTaskOrg this element belongs to
   */
  parentTO: string | undefined;
  /**
   * Open-ended client-defined extension properties.
   * Roundtripped through STP feature structures.
   */
  extensions?: Record<string, unknown>;
}

/**
 * Command relationship
 */
export enum CommandRelationship {
  /**
  * None
  */
  None = "none",
  /**
  * Organic
  */
  Organic = "organic",
  /**
  * Attached
  */
  Attached = "attached",
  /**
  * Assigned
  */
  Assigned = "assigned",
  /**
  * ADCON
  */
  AdCon = "adcon",
  /**
  * OPCON
  */
  OpCon = "opcon",
  /**
  * TACON
  */
  TaCon = "tacon",
  /**
  * Direct Support
  */
  DirectSupport = "ds",
  /**
  * Reinforcing
  */
  Reinforcing = "r",
  /**
  * General Support Reinforcing
  */
  GeneralSupportReinforcing = "gsr",
  /**
  * General Support
  */
  GeneralSupport = "gs"
};


/**
 * STP military task
 */
export class StpTask extends StpItem {
  /**
   * Task description
   */
  description: string | undefined;
  /**
   * Unique id of the unit executing the task
   */
  who: string | undefined;
  /**
   * Unique id of the supported unit, if applicable
   */
  supported: string | undefined;  
  /**
   * Task's Tactical Graphics unique ids
   */
  tgs: string[] | undefined;
  /**
   * Task name, such as 'AssaultObjectiveOnAxis'
   */
  name: string | undefined;
  /**
   * Task How
   */
  how: TaskHow | undefined;
  /**
   * Task What
   */
  what: TaskWhat | undefined;
  /** 
   * Task Why
  */
  why: TaskWhy | undefined; // Special case: prolog does not appear to be able to handle the empty (UNKNOWN) case
  /**
   * Task Rules of Engagement
   */
 rulesOfEngagement: TaskROE | undefined;
  /**
   * Start time slot
   */
  startTime: number | undefined;
  /**
   * End time slot
   */
  endTime: number | undefined;
  /**
   * Associated speech, if applicabel
   */
  speech: string | undefined;
  /**
   * Language describing the task
   */
  language: string | undefined;
  /**
   * Automatic or manual creation status
   */
  taskStatus: | ('implicit' | 'explicit') | undefined;
  /**
   * Confirmation status
   */
  uiStatus: | ('confirming' | 'confirmed') | undefined;
  /**
   * Task interpretation likelihood 
   */
  prob: number | undefined;
  /**
   * Movement features
   */
  movementFeatures: MovementFeatures | undefined;
  /**
  //  * Fires features
  //  */
  // firesFeatures: FiresFeatures | undefined;
  /**
   * Tactical Graphics that are expected to be defined in a type of task - may be empty
   */
  //tgsDesired: TaskTG[] | undefined;
  /**
   * Roles/user groups associated with this type of task
   */
  //userGroups: TaskUserGroup[] | undefined;
  /**
   * Key element triggering the task
   */
  //trigger: string | undefined;
  /**
   * Tags this task is defined under
   */
  //taskSets: string[] | undefined;
  /**
   * Task version in STP's store
   */
  //fsdbVersion: string | undefined;
  /**
   * Associated ink/stroke unique id
   */
  //glyphPoid: string | undefined

  /*
  asGeoJSON() {
  'type': 'FeatureCollection',
  'features': [
  {
    'type': 'Feature',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [
          [
          [-121.353637, 40.584978],
          ]
        ]
      }
  },
  {
    'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [-121.415061, 40.506229]
      }
  },
]
}
*/
}

/**
 * COA properties
 */
export class StpCoa {
  /**
   * Type of item: "coa"
   */
  fsTYPE: string | undefined;
  /**
   * COA name
   */
  name: string | undefined;
  /**
   * STP unique identifier
   */
  poid: string | undefined;
  /**
   * COA affiliation: friend, hostile
   */
  affiliation: string | undefined;
  /**
   * Role that created the symbol: S2, S3, S4, Eng, FSO
   */
  creatorRole: string | undefined;
  /**
   * State details
   */
  state: TaskOrgState | undefined;
}

export class TaskOrgState
{
  /**
   * Type of item: "task_org_state"
   */
  fsTYPE: string | undefined;
  /**
   * Version date
   */
  date: string | undefined;
  /**
   * Role : S2, S3, S4, Eng, FSO
   */
  userRole: string | undefined;
}

/**
 * 2525D and C military codes
 */
export class Sidc {
  /**
   * 2525D 20 or 30 character code
   */
  delta: string | undefined;
  /**
   * Part A of the 2525D id
   */
  get partA(): string | undefined {
    const d = this.delta;
    if (!d || d.length < 10) return undefined;
    return d.substring(0, 10);
  };
  /**
   * Part B of the 2525D id
   */
  get partB(): string | undefined {
    const d = this.delta;
    if (!d || d.length < 20) return undefined;
    return d.substring(10, 20);
  };
  /**
   * Part C of the 2525D id
   */
  get partC(): string | undefined {
    const d = this.delta;
    if (!d || d.length < 30) return undefined;
    return d.substring(20, 30);
  };
  /**
   * 2525D symbol set
   */
  symbolSet: string | undefined;
  /**
   * 2525C SIDC (the engine ships both standards; clients pick the one they render)
   */
  charlie: string | undefined;
  /**
   * 2525C SIDC.
   * @deprecated Use {@link charlie} - same value under the meaningful name. Kept as an
   * alias so existing clients keep working; the wire ships both during the deprecation.
   */
  get legacy(): string | undefined {
    return this.charlie;
  };
  set legacy(value: string | undefined) {
    this.charlie = value;
  };

  /**
   * Hydrate from a plain object, reconstructing delta from parts if needed.
   * Object.assign cannot set getter-only properties (partA/B/C), so we
   * must rebuild delta from the raw values the engine sends.
   */
  static fromPlain(obj: any): Sidc {
    const sidc = new Sidc();
    // Engine may send delta directly, or individual parts
    if (obj.delta) {
      sidc.delta = obj.delta;
    } else {
      // Reconstruct delta from parts sent by the engine
      const a = obj.partA ?? '';
      const b = obj.partB ?? '';
      const c = obj.partC ?? '';
      const combined = `${a}${b}${c}`;
      if (combined.length > 0) sidc.delta = combined;
    }
    sidc.charlie = obj.charlie ?? obj.legacy;
    sidc.symbolSet = obj.symbolSet;
    return sidc;
  }
}

/**
 * Location properties
 */
export class Location {
  /**
   * General type of location
   */
  fsTYPE: ('point' | 'line' | 'area' | 'multipoint') | undefined;
  /**
   * Width
   */
  width: number | undefined;
  /**
   * Altitude
   */
  altitude: number | undefined;
  /**
   * Gesture type (see "STP Military Symbol Gestures" documentation for details - available from Hyssos Tech upon request)
   */
  shape:
    | (
        | 'point'
        | 'line'
        | 'area'
        | 'straightline'
        | 'arrowthin'
        | 'arrowfat'
        | 'hook'
        | 'ubend'
        | 'ubendthreepoints'
        | 'vee'
        | 'opencircle'
        | 'multipoint'
      )
    | undefined;
  /**
   * Radius of the area around the symbol
   */
  radius: number | undefined;
  /**
   * Latitude and longitude coordinates for the symbol
   * These follow the anchor points Draw Rules definitions both in terms of the number of points as well as their order,
   * as documented e.g. in Appendix H of the MIL-STD-2525D Joint Military Symbology standard
   */
  coords: LatLon[] | undefined;
  /**
   * Symbol centroid
   */
  centroid: LatLon | undefined;
  /**
   * Symbols intersected by "coords", expressed as unique STP identifiers
   */
  candidatePoids: string[] | undefined;
}


// /**
//  * TaskUnit
//  */
// export class TaskUnit {
//   /**
//    * Type of this item
//    */
//   fsTYPE: 'task_unit' | undefined;
//   /**
//    * Unit class, such as 'GroundManeuverUnitSymbol'
//    */
//   unitClass: string | undefined;
//   /**
//    * Unit's unique id
//    */
//   symbol: Poid | undefined;

//   /**
//  * Constructor
//  * @param id - unit unique id
//  */
//   constructor(id: string) {
//     this.symbol = new Poid(id);
//   }
// }

// /**
//  * TaskTG
//  */
// export class TaskTG {
//   fsTYPE: 'task_tg' | undefined;
//   tgClass: string | undefined;
//   symbol: Poid | undefined;
// }

// /**
//  * Task unser group
//  */
// export class TaskUserGroup {
//   fdTYPE: 'usergroups' | undefined;
//   role: string | undefined;
//   affiliation: string | undefined; // Enum?
// }

/**
 * Task movement features
 */
export class MovementFeatures {
  fsTYPE: 'movement_features' | undefined;
  movement: boolean | undefined;
  movesTo: string | undefined;
}

// /**
//  * Task fires features
//  */
// export class FiresFeatures {
//   fsTYPE: 'fires_features' | undefined;
//   // TODO:  add fires features properties
// }

/**
 * Task What
 */
export enum TaskWhat {
  NotSpecified = "not_specified",
  AdvisePolice = "advise_police",
  Ambush = "ambush",
  AssignResponsibility = "assign_responsibility",
  Block = "block",
  BombAttack = "bomb_attack",
  Breach = "breach",
  Bypass = "bypass",
  Clear = "clear",
  CoerciveRecruiting = "coercive_recruiting",
  CollectCasualties = "collect_casualties",
  CollectCivilians = "collect_civilians",
  CollectPrisoners = "collect_prisoners",
  ConductAmbush = "conduct_ambush",
  ConductAviatonAmbush = "conduct_aviaton_ambush",
  ConductBilat = "conduct_bilat",
  ConductGroupEngagement = "conduct_group_engagement",
  ConductRaid = "conduct_raid",
  ConductTcpOperation = "conduct_tcp_operation",
  ConstituteReserve = "constitute_reserve",
  Convoy = "convoy",
  Defeat = "defeat",
  Delay = "delay",
  DeliverLeafletPsyop = "deliver_leaflet_psyop",
  Demonstrate = "demonstrate",
  Destroy = "destroy",
  Disrupt = "disrupt",
  DistributeFood = "distribute_food",
  Emplace = "emplace",
  EquipPolice = "equip_police",
  EscortConvoy = "escort_convoy",
  EvacuateCasualties = "evacuate_casualties",
  EvacuateCivilians = "evacuate_civilians",
  EvacuatePrisoners = "evacuate_prisoners",
  Fix = "fix",
  Follow = "follow",
  FollowAndAssume = "follow_and_assume",
  FollowAndSupport = "follow_and_support",
  Halt = "halt",
  HarrassmentFires = "harrassment_fires",
  HouseToHousePsyop = "house_to_house_psyop",
  IedAttack = "ied_attack",
  Limit = "limit",
  Looting = "looting",
  MaintainHide = "maintain_hide",
  MaintainOutpost = "maintain_outpost",
  Move = "move",
  Neutralize = "neutralize",
  Observe = "observe",
  Occupy = "occupy",
  Patrol = "patrol",
  Penetrate = "penetrate",
  PositionSniper = "position_sniper",
  PriorityOfFires = "priority_of_fires",
  ProvideMedicalServices = "provide_medical_services",
  ProvideService = "provide_service",
  Receive = "receive",
  Reconstruction = "reconstruction",
  RecruitPolice = "recruit_police",
  Refuel = "refuel",
  RegulateTraffic = "regulate_traffic",
  Reinforce = "reinforce",
  Release = "release",
  Resupply = "resupply",
  Retain = "retain",
  Rioting = "rioting",
  Secure = "secure",
  SeekRefuge = "seek_refuge",
  Seize = "seize",
  SniperAttack = "sniper_attack",
  Supply = "supply",
  SupplyMunitions = "supply_munitions",
  TrainPolice = "train_police",
  TransferMunitions = "transfer_munitions",
  TrashRemoval = "trash_removal",
  Turn = "turn",
  TvRadioPsyop = "tv_radio_psyop",
  WaterDelivery = "water_delivery",
  WillfulRecruiting = "willful_recruiting"
}

/**
 * Task How
 */
export enum TaskHow {
  NotSpecified = "not_specified",
  AirAssault = "air_assault",
  AirReconnaissance = "air_reconnaissance",
  AreaDefense = "area_defense",
  Assault = "assault",
  Attack = "attack",
  AttackInZone = "attack_in_zone",
  AttackByFire = "attack_by_fire",
  CerpFunding = "cerp_funding",
  Civilian = "civilian",
  Contracting = "contracting",
  CordonAndSearch = "cordon_and_search",
  Counterattack = "counterattack",
  CounterattackByFire = "counterattack_by_fire",
  Cover = "cover",
  Defend = "defend",
  DeliverServices = "deliver_services",
  Guard = "guard",
  InformationOperations = "information_operations",
  Insurgent = "insurgent",
  MobileDefense = "mobile_defense",
  MovingScreen = "moving_screen",
  NgoOperation = "ngo_operation",
  PassageOfLines = "passage_of_lines",
  Screen = "screen",
  SearchAndAttack = "search_and_attack",
  Security = "security",
  SecurityForceAssistance = "security_force_assistance",
  SupportByFire = "support_by_fire",
  Withdrawal = "withdrawal"
}

/**
 * Task Why
 */
export enum TaskWhy {
  Unknown = "unknown",
  Allow = "allow",
  Cause = "cause",
  Create = "create",
  Deceive = "deceive",
  Deny = "deny",
  Divert = "divert",
  Enable = "enable",
  Envelop = "envelop",
  Influence = "influence",
  Open = "open",
  Prevent = "prevent",
  Protect = "protect",
  Support = "support",
  Surprise = "surprise"
}

/**
 * Task Rules of Engagement
 */
export enum TaskROE {
  NotSpecified = "not_specified",
  Hold = "hold",
  Tight = "tight",
  Free = "free"
}

// /**
//  * Unique id
//  */
// export class Poid {
//   /**
//    * Unique id
//    */
//   id: string | undefined;

//   /**
//  * Constructor
//  * @param id - unique id
//  */
//   constructor(id: string) {
//     this.id = id;
//   }
//   /**
//    * Compares this content to another object's
//    * @param rhs - object to compare to this
//    * @returns True if rhs' contents are the same as this
//    */
//   equals(rhs: Poid): boolean {
//     return this.id == rhs.id;
//   }
//}

/**
 * Latitude and longitude coordinates
 */
export class LatLon {
  /**
   * Latitude
   */
  lat: number;
  /**
   * Lomgitude
   */
  lon: number;

  /**
   * Constructs a latitude, longitude coordinate
   * @constructor
   * @param lat - Latitude
   * @param lon - Longitude
   */
  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }
  /**
   * Compares this content to another object's
   * @param rhs - object to compare to this
   * @returns True if rhs' contents are the same as this
   */
  equals(rhs: LatLon): boolean {
    return this.lat == rhs.lat && this.lon == rhs.lon;
  }
}

/**
 * Time interval
 */
export class Interval {
  /**
   * Date the interval starts
   */
  start: Date;
  /**
   * Date the interval ends
   */
  end: Date;

  /**
   * Constructs an interval
   * @constructor
   * @param start - Start time
   * @param end - End time
   */
  constructor(start: Date, end: Date) {
    this.start = start;
    this.end = end;
  }
  /**
   * Compares this content to another object's
   * @param rhs - object to compare to this
   * @returns True if rhs' contents are the same as this
   */
  equals(rhs: Interval): boolean {
    return this.start == rhs.start && this.end == rhs.end;
  }
}

/**
 * Size (width, height)
 */
export class Size {
  /**
   * Width
   */
  width: number;
  /**
   * Height
   */
  height: number;

  /**
   * Construct Size
   * @param width - Width
   * @param height - Height
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Compares this content to another object's
   * @param rhs - Object to compare to this
   * @returns True if rhs' contents are the same as this
   */
  equals(rhs: Size): boolean {
    return this.width == rhs.width && this.height == rhs.height;
  }
}

/**
 * DIS Code
 */
export class DISCode {
  /**
   * DIS category
   */
  category: number | undefined;
  /**
   * DIS country code
   */
  country: string | undefined;
  /**
   * DIS domain
   */
  domain: number | undefined;
  /**
   * DIS "extra" code
   */
  extra: number | undefined;
  /**
   * DIS kind
   */
  kind: number | undefined;
  /**
   * DIS "specific" code
   */
  specific: number | undefined;
  /**
   * DIS subcategory
   */
  subcategory: number | undefined;

  /**
   * Constructor
   * @param category 
   * @param country 
   * @param domain 
   * @param extra 
   * @param kind 
   * @param specific 
   * @param subcategory 
   */
  constructor(category: number, country: string, domain: number, extra: number, kind:number, specific: number, subcategory: number)
  {
    this.category = category;
    this.country = country;
    this.domain = domain;
    this.extra = extra;
    this.kind = kind;
    this.specific = specific;
    this.subcategory = subcategory;
  }

  /**
   * Compares this content to another object's
   * @param rhs - Object to compare to this
   * @returns True if rhs' contents are the same as this
   */
  equals(rhs: DISCode): boolean {
    if (rhs === undefined) {
      return false;
    }
    return this.category == rhs.category &&
      this.country == rhs.country &&
      this.domain == rhs.domain &&
      this.extra == rhs.extra &&
      this.kind == rhs.kind &&
      this.specific == rhs.specific &&
      this.subcategory == rhs.subcategory;
  }
}

export class Resource {
  /**
   * Resource name
   */
  name: string| undefined;
  /**
   * Operational quantity
   */
  operationalQuantity: number | undefined;
  /**
   * SISOEntityType - DIS code
   */
  disCode: DISCode | undefined;
  /**
   * Optional on hand quantity
   */
  onHandQuantity: number | undefined;
  /**
   * Optional required on hand quantity
   */
  requiredOnHandQuantity:  number | undefined;

  /**
   * Constructor 
   */
  constructor(name: string, operationalQuantity: number, disCode: DISCode, onHandQuantity: number | undefined, requiredOnHandQuantity:  number | undefined) {
    this.name = name;
    this.operationalQuantity = operationalQuantity;
    this.disCode = disCode;
    this.onHandQuantity = onHandQuantity;
    this.requiredOnHandQuantity = requiredOnHandQuantity;
  }

  /**
   * Compares this content to another object's
   * @param rhs - Object to compare to this
   * @returns True if rhs' contents are the same as this
   */
  equals(rhs: Resource): boolean {
    if (rhs === undefined) {
      return false;
    }
    return this.name == rhs.name &&
    this.operationalQuantity == rhs.operationalQuantity &&
    this.disCode == rhs.disCode &&
    this.onHandQuantity == rhs.onHandQuantity &&
    this.requiredOnHandQuantity == rhs.requiredOnHandQuantity;
  }
}
