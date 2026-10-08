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
   * Task Rules of Engagement. The engine sends and reads this under the key `roe`.
   */
  roe: TaskROE | undefined;
  /**
   * Task Rules of Engagement.
   * @deprecated Use {@link roe}, the key the engine actually sends and reads. This name was
   * never populated from the wire and was ignored when sent back; it is kept as an alias of
   * `roe` so existing clients keep compiling.
   */
  get rulesOfEngagement(): TaskROE | undefined {
    return this.roe;
  };
  set rulesOfEngagement(value: TaskROE | undefined) {
    this.roe = value;
  };
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
 *
 * Values are the engine's enum member names, exactly as the engine sends them (for
 * example `"AMBUSH"`). Before 0.6.17 they were lower case and never matched a live task.
 */
export enum TaskWhat {
  NotSpecified = "NOT_SPECIFIED",
  AdvisePolice = "ADVISE_POLICE",
  Ambush = "AMBUSH",
  AssignResponsibility = "ASSIGN_RESPONSIBILITY",
  Block = "BLOCK",
  BombAttack = "BOMB_ATTACK",
  Breach = "BREACH",
  Bypass = "BYPASS",
  Canalize = "CANALIZE",
  Clear = "CLEAR",
  CoerciveRecruiting = "COERCIVE_RECRUITING",
  CollectCasualties = "COLLECT_CASUALTIES",
  CollectCivilians = "COLLECT_CIVILIANS",
  CollectPrisoners = "COLLECT_PRISONERS",
  ConductAmbush = "CONDUCT_AMBUSH",
  ConductAviatonAmbush = "CONDUCT_AVIATON_AMBUSH",
  ConductBilat = "CONDUCT_BILAT",
  ConductGroupEngagement = "CONDUCT_GROUP_ENGAGEMENT",
  ConductRaid = "CONDUCT_RAID",
  ConductTcpOperation = "CONDUCT_TCP_OPERATION",
  ConstituteReserve = "CONSTITUTE_RESERVE",
  Contain = "CONTAIN",
  Control = "CONTROL",
  Convoy = "CONVOY",
  Counterreconnaissance = "COUNTERRECONNAISSANCE",
  Defeat = "DEFEAT",
  Delay = "DELAY",
  DeliverLeafletPsyop = "DELIVER_LEAFLET_PSYOP",
  Demonstrate = "DEMONSTRATE",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Demonstrating = "DEMONSTRATING",
  Destroy = "DESTROY",
  Disengage = "DISENGAGE",
  Disrupt = "DISRUPT",
  DistributeFood = "DISTRIBUTE_FOOD",
  Emplace = "EMPLACE",
  EquipPolice = "EQUIP_POLICE",
  EscortConvoy = "ESCORT_CONVOY",
  EvacuateCasualties = "EVACUATE_CASUALTIES",
  EvacuateCivilians = "EVACUATE_CIVILIANS",
  EvacuatePrisoners = "EVACUATE_PRISONERS",
  Exfiltrate = "EXFILTRATE",
  Fix = "FIX",
  Follow = "FOLLOW",
  FollowAndAssume = "FOLLOW_AND_ASSUME",
  FollowAndSupport = "FOLLOW_AND_SUPPORT",
  Halt = "HALT",
  HarassmentFires = "HARASSMENT_FIRES",
  /** @deprecated STP-1019: misspelling of {@link TaskWhat.HarassmentFires}. Kept so values from older servers or saved data still parse; removed in the next major release. */
  HarrassmentFires = "HARRASSMENT_FIRES",
  HouseToHousePsyop = "HOUSE_TO_HOUSE_PSYOP",
  IedAttack = "IED_ATTACK",
  Interdict = "INTERDICT",
  Isolate = "ISOLATE",
  Limit = "LIMIT",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Looting = "LOOTING",
  MaintainHide = "MAINTAIN_HIDE",
  MaintainOutpost = "MAINTAIN_OUTPOST",
  Move = "MOVE",
  Neutralize = "NEUTRALIZE",
  Observe = "OBSERVE",
  Occupy = "OCCUPY",
  Patrol = "PATROL",
  Penetrate = "PENETRATE",
  PositionSniper = "POSITION_SNIPER",
  PriorityOfFires = "PRIORITY_OF_FIRES",
  ProvideMedicalServices = "PROVIDE_MEDICAL_SERVICES",
  ProvideService = "PROVIDE_SERVICE",
  Receive = "RECEIVE",
  Reconstruction = "RECONSTRUCTION",
  RecruitPolice = "RECRUIT_POLICE",
  Reduce = "REDUCE",
  Refuel = "REFUEL",
  RegulateTraffic = "REGULATE_TRAFFIC",
  Reinforce = "REINFORCE",
  Release = "RELEASE",
  Resupply = "RESUPPLY",
  Retain = "RETAIN",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Rioting = "RIOTING",
  Secure = "SECURE",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  SeekRefuge = "SEEK_REFUGE",
  Seize = "SEIZE",
  SniperAttack = "SNIPER_ATTACK",
  Supply = "SUPPLY",
  SupplyMunitions = "SUPPLY_MUNITIONS",
  Suppress = "SUPPRESS",
  TrainPolice = "TRAIN_POLICE",
  TransferMunitions = "TRANSFER_MUNITIONS",
  TrashRemoval = "TRASH_REMOVAL",
  Turn = "TURN",
  TvRadioPsyop = "TV_RADIO_PSYOP",
  WaterDelivery = "WATER_DELIVERY",
  WillfulRecruiting = "WILLFUL_RECRUITING"
}

/**
 * Task How
 *
 * Values are the engine's enum member names, exactly as the engine sends them (for
 * example `"CORDON_AND_SEARCH"`). Before 0.6.17 they were lower case and never matched a live task.
 */
export enum TaskHow {
  NotSpecified = "NOT_SPECIFIED",
  AirAssault = "AIR_ASSAULT",
  AirReconnaissance = "AIR_RECONNAISSANCE",
  AreaDefense = "AREA_DEFENSE",
  Assault = "ASSAULT",
  Attack = "ATTACK",
  AttackInZone = "ATTACK_IN_ZONE",
  AttackByFire = "ATTACK_BY_FIRE",
  CerpFunding = "CERP_FUNDING",
  /** @deprecated STP-1001: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  Civilian = "CIVILIAN",
  Contracting = "CONTRACTING",
  CordonAndSearch = "CORDON_AND_SEARCH",
  Counterattack = "COUNTERATTACK",
  CounterattackByFire = "COUNTERATTACK_BY_FIRE",
  Cover = "COVER",
  Defend = "DEFEND",
  DeliverServices = "DELIVER_SERVICES",
  Guard = "GUARD",
  InformationOperations = "INFORMATION_OPERATIONS",
  /** @deprecated STP-1019: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  Insurgent = "INSURGENT",
  MobileDefense = "MOBILE_DEFENSE",
  MovingScreen = "MOVING_SCREEN",
  /** @deprecated STP-1019: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  NgoOperation = "NGO_OPERATION",
  PassageOfLines = "PASSAGE_OF_LINES",
  Screen = "SCREEN",
  SearchAndAttack = "SEARCH_AND_ATTACK",
  Security = "SECURITY",
  SecurityForceAssistance = "SECURITY_FORCE_ASSISTANCE",
  SupportByFire = "SUPPORT_BY_FIRE",
  Withdrawal = "WITHDRAWAL"
}

/**
 * Task Why
 *
 * Values are the engine's enum member names, exactly as the engine sends them (for
 * example `"PROTECT"`). Before 0.6.17 they were lower case and never matched a live task.
 */
export enum TaskWhy {
  Unknown = "UNKNOWN",
  Allow = "ALLOW",
  Cause = "CAUSE",
  Create = "CREATE",
  Deceive = "DECEIVE",
  Deny = "DENY",
  Divert = "DIVERT",
  Enable = "ENABLE",
  Envelop = "ENVELOP",
  Influence = "INFLUENCE",
  Open = "OPEN",
  Prevent = "PREVENT",
  Protect = "PROTECT",
  Support = "SUPPORT",
  Surprise = "SURPRISE"
}

/**
 * Task Rules of Engagement
 *
 * Values are the engine's enum member names, exactly as the engine sends them (for
 * example `"Hold"`). Before 0.6.17 they were lower case and never matched a live task.
 */
export enum TaskROE {
  NotSpecified = "NOT_SPECIFIED",
  Hold = "Hold",
  Tight = "Tight",
  Free = "Free"
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
