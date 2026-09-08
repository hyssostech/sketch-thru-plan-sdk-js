import { IStpConnector } from './interfaces/IStpConnector';
import { ISpeechRecoItem } from './interfaces/ISpeechRecognizer';
import { IC2SIMProxy } from './interfaces/IC2SIMProxy';
import * as StpType from './stptypes';
import { StpMessageLevel } from './stptypes';
import { StpC2SIMProxy } from './stpc2simproxy';
import StpC2SIMOptions from './stpc2simoptions';

/**
 * Commands and events to interact with STP
 */
export class StpRecognizer{
  stpConnector: IStpConnector;
  serviceName: string;

  //#region Construction and connection
  /**
   * Construct STP SDK object
   * @constructor
   * @param stpConnector - Connector object through which the SDK communicates with STP
   */
  constructor(stpConnector: IStpConnector) {
    this.stpConnector = stpConnector;
    this.serviceName = '';
    //this.hasActiveScenario = false;
  }

  /**
   * Connect to the STP engine
   * Important: the event function properties need to be assigned to handlers _before_ this method is called
   * @param serviceName - Name of this component / service
   * @param timeout - Number fo seconds to wait for a connection before failing
   * @param machineId - Optional machine Id to use. If not provided, no id is sent and STP uses the host's id.
   * @param sessionId - Optional session Id to use. If not provided:
   *  1. the suffix to the WebSocket connection string is used 
   *  2. otherwise STP assigns its default session (the host's id)
   */
  async connect(
    serviceName: string,
    timeout: number,
    machineId?: string,
    sessionId?: string
  ): Promise<string | undefined> {
    this.serviceName = serviceName;
    // Hook up to the event notifications - bound to this object, not the caller's (will be the connector)
    this.stpConnector.onInform = this.onInform.bind(this);
    this.stpConnector.onRequest = this.onRequest.bind(this);
    this.stpConnector.onError = this.onError.bind(this);

    // Connect and then register this service
    try {
      // Build the list of subscriptions based on the events the client has hooked into and connect to STP
      let solvables: string[] = this.buildSolvables();
      // Connect to STP, subscribing to the events above
      return this.stpConnector.connect(
        this.serviceName,
        solvables,
        timeout,
        machineId,
        sessionId
      );
    } catch (e) {
      // Bubble the error up
      throw e;
    }
  }

  /**
   * Rebuild the list of subscribed events from the handlers CURRENTLY assigned, and re-register with STP.
   *
   * IMPORTANT: subscriptions are fixed at connect time - buildSolvables() only runs once, inside connect().
   * If an on* handler is assigned AFTER connect() has already resolved, STP will never route that event to
   * this client until this method is called to pick up the new handler. Call it any time a handler is
   * attached (or removed) past the initial connect().
   * @throws Error if called before a connection to STP has been established
   */
  public async refreshSubscriptions(): Promise<void> {
    if (!this.stpConnector.isConnected) {
      throw new Error(
        'Cannot refresh subscriptions: not connected to STP. Call connect() first.'
      );
    }
    if (typeof this.stpConnector.updateSolvables !== 'function') {
      throw new Error(
        'Cannot refresh subscriptions: the connector in use does not support updateSolvables().'
      );
    }
    const solvables: string[] = this.buildSolvables();
    await this.stpConnector.updateSolvables(solvables);
  }

  /**
   * Build a list of messages that this service handles based on the event subscriptions that were set
   * @ignore
   */
  private buildSolvables(): string[] {
    // Get the name of all properties of this object, filter those that start with 'on' and are functions,
    // and clip the 'on' prefix
    // Only those properties that have been initialized are listed, which in this case is what we want
    return Object.getOwnPropertyNames(this)
      .filter(
        (name) =>
          name.toString().startsWith('on') &&
          typeof this[name as keyof StpRecognizer] == 'function'
      )
      .map((name) => name.substring(2));
  }
  //#endregion

  //#region StpConnector event handlers
  /**
   * Handles inform messages coming over from STP, invoking the SDK client handlers, if defined
   * @param message - Message / event to handle - JSON string
   */
  private onInform(message: string): void {
    // Parse message into the generic (JsonRPC) { method: 'name', params: {}} envelope
    let msg: StpType.StpMessage = JSON.parse(message);

    // Invoke the handler dispatcher
    this.handleInform(msg);
  }

  /**
   * Handles request messages coming over from STP
   * @param message - Message / event to handle - JSON string
   * @return Array of results (JSON strings)
   */
  private onRequest(message: string): string[] {
    this.onInform(message);
    return [];
  }

  /**
   * Connection error notification
   * @param exception - Description of the connection error
   */
  private onError(error: string): void {
    if (this.onStpMessage) {
      this.onStpMessage(error, StpMessageLevel.Error);
    }
  }
  //#endregion

  //#region Handler dispatching
  private handleInform(msg: StpType.StpMessage) {
    // Invoke a handler
    if (msg.method === 'SymbolAdded' && this.onSymbolAdded) {
      const pp = msg.params as {
        alternates: StpType.StpSymbol[];
        isUndo: boolean;
      };
      let alts: StpType.StpSymbol[] = [];
      for (let i: number = 0; i < pp.alternates.length; i++) {
        // Create symbol object so that methods are also available -  casting recovers just the properties
        const symbol = Object.assign(new StpType.StpSymbol(), pp.alternates[i]);
        // Hydrate nested Sidc: engine sends partA/B/C directly, not delta
        if (symbol.sidc) symbol.sidc = StpType.Sidc.fromPlain(symbol.sidc);
        alts.push(symbol);
      }
      this.onSymbolAdded(alts, pp.isUndo);
    } else if (msg.method === 'SymbolModified' && this.onSymbolModified) {
      const pp = msg.params as {
        poid: string;
        symbol: StpType.StpSymbol;
        isUndo: boolean;
      };
      const symbol = Object.assign(new StpType.StpSymbol(), pp.symbol);
      if (symbol.sidc) symbol.sidc = StpType.Sidc.fromPlain(symbol.sidc);
      this.onSymbolModified(pp.poid, symbol, pp.isUndo);
    } else if (msg.method === 'SymbolDeleted' && this.onSymbolDeleted) {
      const pp = msg.params as {
        poid: string;
        isUndo: boolean;
      };
      this.onSymbolDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'SymbolReport' && this.onSymbolReport) {
      const pp = msg.params as {
        poid: string;
        symbol: StpType.StpSymbol;
      };
      const symbol = Object.assign(new StpType.StpSymbol(), pp.symbol);
      if (symbol.sidc) symbol.sidc = StpType.Sidc.fromPlain(symbol.sidc);
      this.onSymbolReport(pp.poid, symbol);
    } else if (msg.method === 'TaskOrgAdded' && this.onTaskOrgAdded || msg.method === 'TaskOrgModified' && this.onTaskOrgModified) {
      const pp = msg.params as {
        poid: string;
        taskOrg: StpType.StpTaskOrg;
        isUndo: boolean;
      };
      const taskOrg = Object.assign(new StpType.StpTaskOrg(), pp.taskOrg);
      if (msg.method === 'TaskOrgAdded' && this.onTaskOrgAdded) {
        this.onTaskOrgAdded(taskOrg, pp.isUndo);
      }
      else if (msg.method === 'TaskOrgModified' && this.onTaskOrgModified) {
        this.onTaskOrgModified(pp.poid, taskOrg, pp.isUndo);
      }
    } else if (msg.method === 'TaskOrgDeleted' && this.onTaskOrgDeleted) {
      const pp = msg.params as { poid: string; isUndo: boolean };
      this.onTaskOrgDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'TaskOrgUnitAdded' && this.onTaskOrgUnitAdded || msg.method === 'TaskOrgUnitModified' && this.onTaskOrgUnitModified) {
      const pp = msg.params as {
        poid: string;
        toUnit: StpType.StpTaskOrgUnit;
        isUndo: boolean;
      };
      const unit = Object.assign(new StpType.StpTaskOrgUnit(), pp.toUnit);
      if (unit.sidc) unit.sidc = StpType.Sidc.fromPlain(unit.sidc);
      if (msg.method === 'TaskOrgUnitAdded' && this.onTaskOrgUnitAdded) {
        this.onTaskOrgUnitAdded(unit, pp.isUndo);
      }
      else if (msg.method === 'TaskOrgUnitModified' && this.onTaskOrgUnitModified) {
        this.onTaskOrgUnitModified(pp.poid, unit, pp.isUndo);
      }
    } else if (msg.method === 'TaskOrgUnitDeleted' && this.onTaskOrgUnitDeleted) {
      const pp = msg.params as {
        poid: string;
        isUndo: boolean;
      };
      this.onTaskOrgUnitDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'TaskOrgRelationshipAdded' && this.onTaskOrgRelationshipAdded || msg.method === 'TaskOrgRelationshipModified' && this.onTaskOrgRelationshipModified) {
      const pp = msg.params as {
        poid: string;
        toRelationship: StpType.StpTaskOrgRelationship;
        isUndo: boolean;
      };
      const unit = Object.assign(new StpType.StpTaskOrgRelationship(), pp.toRelationship);
      if (msg.method === 'TaskOrgRelationshipAdded' && this.onTaskOrgRelationshipAdded) {
        this.onTaskOrgRelationshipAdded(unit, pp.isUndo);
      }
      else if (msg.method === 'TaskOrgRelationshipModified' && this.onTaskOrgRelationshipModified) {
        this.onTaskOrgRelationshipModified(pp.poid, unit, pp.isUndo);
      }
    } else if (msg.method === 'TaskOrgRelationshipDeleted' && this.onTaskOrgRelationshipDeleted) {
      const pp = msg.params as { poid: string; isUndo: boolean };
      this.onTaskOrgRelationshipDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'TaskAdded' && this.onTaskAdded || msg.method === 'TaskModified' && this.onTaskModified) {
      const pp = msg.params as {
        poid: string,
        alternates: StpType.StpTask[];
        taskPoids: string[];
        isUndo: boolean;
      };
      let alts: StpType.StpTask[] = [];
      for (let i: number = 0; i < pp.alternates.length; i++) {
        // Create symbol object so that methods are also available - casting recovers just the properties
        const task = Object.assign(new StpType.StpTask(), pp.alternates[i]);
        alts.push(task);
      }
      if (msg.method === 'TaskAdded' && this.onTaskAdded) {
        this.onTaskAdded(pp.poid, alts, pp.taskPoids, pp.isUndo);
      }
      else if (msg.method === 'TaskModified' && this.onTaskModified) {
        this.onTaskModified(pp.poid, alts, pp.taskPoids, pp.isUndo);
      }
    } else if (msg.method === 'TaskDeleted' && this.onTaskDeleted) {
      const pp = msg.params as {
        poid: string
        isUndo: boolean;
      };
      this.onTaskDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'TaskOrgSwitched' && this.onTaskOrgSwitched) {
      const pp = msg.params as {
        taskOrg: StpType.StpTaskOrg;
      };
      this.onTaskOrgSwitched(pp.taskOrg);
    } else if (msg.method === 'CoaAdded' && this.onCoaAdded || msg.method === 'CoaModified' && this.onCoaModified) {
      const pp = msg.params as {
        poid: string;
        coa: StpType.StpCoa;
        isUndo: boolean;
      };
      const unit = Object.assign(new StpType.StpCoa(), pp.coa);
      if (msg.method === 'CoaAdded' && this.onCoaAdded) {
        this.onCoaAdded(pp.poid, pp.coa, pp.isUndo);
      }
      else if (msg.method === 'CoaModified' && this.onCoaModified) {
        this.onCoaModified(pp.poid, unit, pp.isUndo);
      }
    } else if (msg.method === 'CoaDeleted' && this.onCoaDeleted) {
      const pp = msg.params as { poid: string; isUndo: boolean };
      this.onCoaDeleted(pp.poid, pp.isUndo);
    } else if (msg.method === 'CoaSwitched' && this.onCoaSwitched) {
      const pp = msg.params as {
        coa: StpType.StpCoa;
      };
      this.onCoaSwitched(pp.coa);
    } else if (msg.method === 'RoleSwitched' && this.onRoleSwitched) {
      const pp = msg.params as {
        role: StpType.StpRole;
      };
      this.onRoleSwitched(pp.role);
    } else if (msg.method === 'NewScenario' && this.onNewScenario) {
      this.onNewScenario();
    } else if (msg.method === 'InkProcessed' && this.onInkProcessed) {
      this.onInkProcessed();
    } else if (msg.method === 'SpeechRecognized' && this.onSpeechRecognized) {
      const pp = msg.params as { phrases: string[] };
      this.onSpeechRecognized(pp.phrases);
    } else if (msg.method === 'SpeechDiscarded' && this.onSpeechDiscarded) {
      this.onSpeechDiscarded();
    } else if (msg.method === 'SpeechParsed' && this.onSpeechParsed) {
      const pp = msg.params as { alternates: ISpeechRecoItem[] };
      this.onSpeechParsed(pp.alternates);
    } else if (msg.method === 'SymbolEdited' && this.onSymbolEdited) {
      const pp = msg.params as {
        operation: string;
        location: StpType.Location;
      };
      this.onSymbolEdited(pp.operation, pp.location);
    } else if (msg.method === 'MapOperation' && this.onMapOperation) {
      const pp = msg.params as {
        operation: string;
        location: StpType.Location;
      };
      this.onMapOperation(pp.operation, pp.location);
    } else if (msg.method === 'Command' && this.onCommand) {
      const pp = msg.params as {
        operation: string;
        location: StpType.Location;
      };
      this.onCommand(pp.operation, pp.location);
    } else if (msg.method === 'StpMessage' && this.onStpMessage) {
      const pp = msg.params as {
        message: string;
        level: StpMessageLevel;
      };
      this.onStpMessage(pp.message, pp.level);
    } else {
      // TODO: log error
      console.log('Received message with no handler: ' + msg.method);
    }
    /* 
  onCoaAdded: ((string name, string affiliation, string poid) => void) | undefined;
*/
  }
  //#endregion

 //#region STP messages / events generated by a component
  /**
  * Generic method that handles the actual sending of a message over to STP
  * @param name - Name of the event / method to inform
  * @param parms - parameter object
  */
  public informStp(name: string, parms: any): void {
    try {
      let msg: StpType.StpMessage = {
        method: name,
        params: parms
      };
      this.stpConnector.inform(JSON.stringify(msg));
    } catch (e) {
      // Propagate to the user
      if (this.onStpMessage) {
        this.onStpMessage((<Error>e).message, StpType.StpMessageLevel.Error);
      }
    }
  }

  /**
  * Generic method that handles the STP requests - messages for which results are expected
  * @param name - Name of the event / method to request
  * @param parms - parameter object
  * @param timeout - Optional timeout for this request
  */
  public async requestStp(name: string, parms: any, timeout?: number): Promise<any> {
    try {
      let msg: StpType.StpMessage = {
        method: name,
        params: parms
      };
      return this.stpConnector.request(JSON.stringify(msg), timeout);
    } catch (e) {
      // Propagate to the user
      if (this.onStpMessage) {
        this.onStpMessage((<Error>e).message, StpType.StpMessageLevel.Error);
      }
    }
  }

  //#region Speech and Sketch commands
  /**
   * Advertise that the user has started a sketched gesture
   * @param location - Map coordinate of the first point
   * @param timestamp - Time the first point was placed - ISO 8601
   */
  sendPenDown(
    location: StpType.LatLon,
    timestamp: string
  ): void {
    this.informStp('SendPenDown', {
      location: arguments[0],
      timestamp: arguments[1]
    });
  }

  /**
   * Send sketched gesture to STP
   * @param pixelBoundsWindow - Map region screen bounds in pixels
   * @param topLeftGeoMap - Map top, left coordinates
   * @param bottomRightGeoMap - Map bottom, right coordinates
   * @param strokePoints - Coordinates of the sketched gesture
   * @param timeStrokeStart - Time the first point was placed
   * @param timeStrokeEnd - Time the last point was placed
   * @param intersectedPoids - Symbol Ids of all the symbols that were intersected by the sketched gesture - used for editing operations,
   *                           e.g. when user sketches over a symbol and says "delete this"
   */
  sendInk(
    pixelBoundsWindow: StpType.Size,
    topLeftGeoMap: StpType.LatLon,
    bottomRightGeoMap: StpType.LatLon,
    strokePoints: StpType.LatLon[],
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
  ): void {
    this.informStp('SendInk', {
      pixelBoundsWindow: arguments[0],
      topLeftGeoMap: arguments[1],
      bottomRightGeoMap: arguments[2],
      strokePoints: arguments[3],
      timeStrokeStart: arguments[4],
      timeStrokeEnd: arguments[5],
      intersectedPoids: arguments[6]
    });
  }

  /**
   * Send to STP the transcribed speech results, as obtained by a speech recognizer, or typed by the user
   * @param recoList - List of recognition hypothesis
   * @param startTime - Time speech started - ISO 8601
   * @param endTime - Time speech ended- ISO 8601
   */
  sendSpeechRecognition(
    recoList: ISpeechRecoItem[],
    startTime: Date,
    endTime: Date
  ) {
    this.informStp('SendSpeechRecognition', {
      recoList: arguments[0],
      startTime: arguments[1],
      endTime: arguments[2]
    });
  }

  /**
   * Send a text string to STP that will be treated as if it came from speech recognition.
   * Numbers and letters are converted server-side to equivalent words as they would appear
   * if transcribed by a speech recognizer (e.g. "A 3 1" becomes "alpha three one").
   * @param text - Text to be converted and sent as speech
   * @param startTime - Optional time the speech occurred - ISO 8601. Defaults to current time if not provided.
   */
  sendSimulatedSpeechRecognition(
    text: string,
    startTime?: Date
  ): void {
    this.informStp('SendSimulatedSpeechRecognition', {
      text: arguments[0],
      startTime: arguments[1] ?? null
    });
  }

  /**
   * Set the wait and segmentation timeouts together, in seconds. This is the only public
   * control over how long STP waits before deciding a sketch is finished, so it must be
   * changed whenever a user draws a multi-stroke 2525/APP6 symbol: use 0.0 for ordinary
   * single-stroke point, line and area work, and around 2.5 while a full symbol is being
   * drawn. Fire and forget.
   * @param timeout - Timeout in seconds. 0.0 restores single-stroke behavior.
   */
  changeTimeOut(timeout: number): void {
    this.informStp('ChangeTimeOut', {
      timeout: arguments[0]
    });
  }

  /**
   * Restore the segmentation timeout to its configured default, undoing an earlier changeTimeOut. Fire and forget.
   */
  resetSegmentationTimeout(): void {
    this.informStp('ResetSegmentationTimeout', null);
  }

  /**
   * Turn speech capture on or off for this client. Fire and forget; STP reports the resulting
   * state through the AudioCapture event.
   * @param listen - True to start listening, false to stop.
   */
  setSpeechListening(listen: boolean): void {
    this.informStp('SetSpeechListening', {
      listen: arguments[0]
    });
  }

  /**
   * Recognize whatever has been collected so far instead of waiting for the segmentation timeout to expire. Fire and forget.
   */
  recognizeNow(): void {
    this.informStp('RecognizeNow', null);
  }

  /**
   * Ask STP to start or stop listening. Fire and forget.
   * @param mode - Listening mode: once listens until the first inactivity, on listens until told to stop, off stops.
   * @param time - Optional timestamp of the request. Defaults to now if not provided.
   */
  sendListen(mode: StpType.ListenMode, time?: Date): void {
    this.informStp('SendListen', {
      mode: arguments[0],
      time: arguments[1] ?? null
    });
  }

  /**
   * Report this client's own audio capture state to STP so other components can reflect it in their user interface. Fire and forget.
   * @param isListening - True while this client is capturing audio.
   */
  sendAudioCaptureState(isListening: boolean): void {
    this.informStp('SendAudioCaptureState', {
      isListening: arguments[0]
    });
  }
  //#endregion

  //#region Scenario commands
  /**
   * Create and load a new scenario, replacing any previous content that might have been loaded into STP
   * @param name
   * @param timeout - Optional timeout in seconds
   */
  async createNewScenario(name: string, timeout?: number): Promise<void> {
    return this.requestStp('CreateNewScenario', {
      name: arguments[0],
    }, timeout);
  }

  /**
   * Load a new scenario, replacing any previous content that might have been loaded into STP
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  async loadNewScenario(content: string, timeout?: number): Promise<void> {
    return this.requestStp('LoadNewScenario', {
      content: arguments[0],
    }, timeout);
  }

  /**
   * Load additional data into an existing scenario
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  async importPlanData(content: string, timeout?: number): Promise<void> {
    return this.requestStp('ImportPlanData', {
      content: arguments[0],
    }, timeout);
  }

  /**
   *Get the current scenario content as a multiline string ready to be persisted
   * @param timeout - Optional timeout in seconds
   * @returns Scenario content, formatted as object_set([[element1], [element2], ...])
   */
  async getScenarioContent(timeout?: number): Promise<string> {
    return this.requestStp('GetScenarioContent',
      null,
      timeout);
  }

  /**
   * Load all current STP objects into a project - this emulates receiving the STP events to create objects
   * @param timeout - Optional timeout in seconds
   */
  async joinScenarioSession(timeout?: number): Promise<void> {
    return this.requestStp('JoinScenarioSession',
      null,
      timeout);
  }

  /**
   * Load a scenario, updating a session content with detected differences 
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  async syncScenarioSession(content: string, timeout?: number): Promise<void> {
    return this.requestStp('SyncScenarioSession', {
      content: arguments[0],
    }, timeout);
  }

  /**
   * Checks STP for a loaded scenario
   * @param timeout - Optional timeout in seconds
   * @returns True if a scenario is active
   */
  async hasActiveScenario(timeout?: number): Promise<boolean> {
    return this.requestStp('HasActiveScenario',
      null,
      timeout);
  }

  /**
   * Load a new scenario from typed objects, replacing any previous content
   * @param objects - Array of STP objects to load as the new scenario
   * @param timeout - Optional timeout in seconds
   */
  async loadNewScenarioFromObjectSet(objects: StpType.StpItem[], timeout?: number): Promise<void> {
    return this.requestStp('LoadNewScenarioFromObjectSet', {
      objects: arguments[0],
    }, timeout);
  }

  /**
   * Import typed objects into the current scenario (merge, no clear)
   * @param objects - Array of STP objects to merge into the active scenario
   * @param timeout - Optional timeout in seconds
   */
  async importPlanDataFromObjectSet(objects: StpType.StpItem[], timeout?: number): Promise<void> {
    return this.requestStp('ImportPlanDataFromObjectSet', {
      objects: arguments[0],
    }, timeout);
  }

  /**
   * Get the current scenario content as an array of typed objects
   * @param timeout - Optional timeout in seconds
   * @returns Array of STP objects in the current scenario
   */
  async getScenarioObjectSet(timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetScenarioObjectSet',
      null,
      timeout);
  }

  /**
   * Sync a session using typed objects, updating with detected differences
   * @param objects - Array of local STP objects to sync against the server state
   * @param timeout - Optional timeout in seconds
   */
  async syncScenarioSessionFromObjectSet(objects: StpType.StpItem[], timeout?: number): Promise<void> {
    return this.requestStp('SyncScenarioSessionFromObjectSet', {
      objects: arguments[0],
    }, timeout);
  }

  /**
   * Import a Task Org from typed objects
   * @param objects - Array of task org objects (StpTaskOrg, StpTaskOrgUnit, StpTaskOrgRelationship)
   * @param timeout - Optional timeout in seconds
   * @returns TO's unique id
   */
  async importTaskOrgFromObjectSet(objects: StpType.StpItem[], timeout?: number): Promise<string> {
    return this.requestStp('ImportTaskOrgFromObjectSet', {
      objects: arguments[0],
    }, timeout);
  }

  /**
   * Get Task Org content as an array of typed objects
   * @param poid - TO's unique id
   * @param timeout - Optional timeout in seconds
   * @returns Array of task org objects
   */
  async getTaskOrgObjectSet(poid: string, timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetTaskOrgObjectSet', {
      poid: arguments[0],
    }, timeout);
  }

  /**
   * Import a COA from typed objects
   * @param objects - Array of COA objects (StpCoa + symbols)
   * @param timeout - Optional timeout in seconds
   * @returns New COA's unique id
   */
  async importCoaFromObjectSet(objects: StpType.StpItem[], timeout?: number): Promise<string> {
    return this.requestStp('ImportCoaFromObjectSet', {
      objects: arguments[0],
    }, timeout);
  }

  /**
   * Get COA content as an array of typed objects
   * @param poid - COA's unique id
   * @param timeout - Optional timeout in seconds
   * @returns Array of COA objects
   */
  async getCoaObjectSet(poid: string, timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetCoaObjectSet', {
      poid: arguments[0],
    }, timeout);
  }

  /**
   * Discard the current scenario contents on the server, leaving the scenario itself in place.
   * @param timeout - Optional timeout in seconds
   */
  async resetStpScenario(timeout?: number): Promise<void> {
    return this.requestStp('ResetStpScenario', null, timeout);
  }

  /**
   * Return the metadata of the scenario currently loaded - its name, id and session details - without fetching any of its contents.
   * @param timeout - Optional timeout in seconds
   * @returns Scenario metadata, or null/undefined if no scenario is loaded
   */
  async getActiveScenarioDescription(timeout?: number): Promise<any> {
    return this.requestStp('GetActiveScenarioDescription', null, timeout);
  }

  /**
   * Return every object in the current scenario as a flat list - symbols, tasks and task organizations alike.
   * Prefer getScenarioContent or getScenarioObjectSet when the structured form is wanted.
   * @param timeout - Optional timeout in seconds
   * @returns Array of STP objects in the current scenario
   */
  async getAllObjects(timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetAllObjects', null, timeout);
  }

  /**
   * Return the objects deleted from the current scenario. A deleted object is tombstoned rather
   * than removed, so it is still reachable here and its poid can be reused by a later add.
   * @param timeout - Optional timeout in seconds
   * @returns Array of deleted STP objects
   */
  async getDeletedObjects(timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetDeletedObjects', null, timeout);
  }

  /**
   * Return a single object by its unique id.
   * @param poid - Unique id of the object to fetch
   * @param timeout - Optional timeout in seconds
   * @returns The object, or null if no object carries that poid
   */
  async getPoidObject(poid: string, timeout?: number): Promise<StpType.StpItem | null> {
    return this.requestStp('GetPoidObject', {
      poid: arguments[0],
    }, timeout);
  }
  //#endregion

  //#region C2SIM
  /**
   * C2SIM proxy factory
   * @param options - Optional C2SIM generation options overriding the server's defaults
   * @returns Object to be used to interact with C2SIM
   */
  createC2SIMProxy(options?: StpC2SIMOptions) : IC2SIMProxy {
    return new StpC2SIMProxy(this, options);
  }
  //#endregion

  //#region Symbol commands
  /**
   * Request that a symbol be added by STP. The actual addition should only happen when STP responds with SymbolAdded
   * @param symbol Symbol to be added
   */
  addSymbol(symbol: StpType.StpSymbol) {
    this.informStp('AddSymbol', {
      symbol: arguments[0]
    });
  }

  /**
   * Request that a symbol be updated by STP. The actual update should only happen when STP responds with SymbolModified
   * @param poid Unique identifier of the symbol to update
   * @param symbol Symbol to be updated
   */
  updateSymbol(poid: string, symbol: StpType.StpSymbol) {
    this.informStp('UpdateSymbol', {
      poid: arguments[0],
      symbol: arguments[1]
    });
  }

  /**
   * Request a symbol deletion from STP. The actual removal should only happen when STP responds with SymbolDeleted
   * @param poid Unique identifier of the symbol to delete
   */
  deleteSymbol(poid: string) {
    this.informStp('DeleteSymbol', {
      poid: arguments[0]
    });
  }

  /**
   * Pick an alternate recognition for a symbol/task. The STP runtime responds with an object chosen notification
   * @param poid Unique identifier of the symbol for which an alternate is being picked
   * @param nBestIndex Index indicating which of the current alternates is selected
   */
  chooseAlternate(poid: string, nBestIndex: number) {
    this.informStp('ChooseAlternate', {
      poid: arguments[0],
      nBestIndex: arguments[1]
    });
  }
  //#endregion

  //#region TO commands
  /**
   * Import TO into the scenario
   * The TO is imported with a new unique Ids, i.e., the content is used as a template
   * The individual task org units retain their original unique Ids
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   * @returns TO's unique id
   */
  async importTaskOrgContent(content: string, timeout?: number): Promise<string> {
    return this.requestStp('ImportTaskOrgContent', {
      content: arguments[0],
    }, timeout);
  }

  /**
   * Get TO content as a multiline string ready to be persisted
   * @param poid -TO's unique id
   * @param timeout - Optional timeout in seconds
   * @returns - TO content, formatted as object_set([[element1], [element2], ...]) 
   */
  async getTaskOrgContent(poid: string, timeout?: number): Promise<string> {
    return this.requestStp('GetTaskOrgContent', {
      poid: arguments[0],
    }, timeout);
  }

  /**
 * Set TO to use when a particular COA is selected, or globally, when any COA (of the corresponding affiliation)
 * is selected
 * @param poid - Unique id of the TO to set
 * @param timeout - Optional timeout in seconds
 */
  async setDefaultTaskOrg(poid: string, timeout?: number): Promise<void> {
    return this.requestStp('SetDefaultTaskOrg', {
      poid: arguments[0],
    }, timeout);
  }

  /**
   * Reset TO as the default - TO is not deleted, but is no longer active
   * @param affiliation - affiliation of the TO to reset as the default
   * @param timeout - Optional timeout in seconds
   */
  async resetDefaultTaskOrg(affiliation: ('friend' | 'hostile'), timeout?: number): Promise<void> {
    return this.requestStp('ResetDefaultTaskOrg', {
      affiliation: arguments[0],
    }, timeout);
  }

  /**
   * Add a new TO to the scenario
   * @param taskOrg - TO to add 
   * @returns TO's unique id
   */
  addTaskOrg(taskOrg: StpType.StpTaskOrg) {
    this.informStp('AddTaskOrg', {
      taskOrg: arguments[0],
    });
  }

  /**
   * Update TO definition
   * @param poid 
   * @param taskOrg - updated TO
   */
  updateTaskOrg(poid: string, taskOrg: StpType.StpTaskOrg) {
    this.informStp('UpdateTaskOrg', {
      poid: arguments[0],
      taskOrg: arguments[1],
    });
  }

  /**
   * Delete TO from scenario
   * @param poid 
   */
  deleteTaskOrg(poid: string) {
    this.informStp('DeleteTaskOrg', {
      poid: arguments[0],
    });
  }

  /**
   * Request that a Task Org Unit be added by STP. The actual addition should only happen when STP responds with TaskOrgUnitAdded
   * @param toUnit Task Org Unit to be added
   */
  addTaskOrgUnit(toUnit: StpType.StpTaskOrgUnit) {
    this.informStp('AddTaskOrgUnit', {
      toUnit: arguments[0]
    });
  }

  /**
   * Request that a Task Org Unit be updated by STP. The actual update should only happen when STP responds with TaskOrgUnitModified
   * @param poid Unique identifier of the Task Org Unit to update
   * @param toUnit Task Org Unit to be updated
   */
  updateTaskOrgUnit(poid: string, toUnit: StpType.StpTaskOrgUnit) {
    this.informStp('UpdateTaskOrgUnit', {
      poid: arguments[0],
      toUnit: arguments[1]
    });
  }

  /**
   * Request a Task Org Unit deletion from STP. The actual removal should only happen when STP responds with TaskOrgUnitDeleted
   * @param poid Unique identifier of the Task Org Unit to delete
   */
  deleteTaskOrgUnit(poid: string) {
    this.informStp('DeleteTaskOrgUnit', {
      poid: arguments[0]
    });
  }

  /**
   * Request that a Task Org Relationship be added by STP. The actual addition should only happen when STP responds with TaskOrgRelationshipAdded
   * @param toRelationship Task Org Relationship to be added
   */
  addTaskOrgRelationship(toUnit: StpType.StpTaskOrgRelationship) {
    this.informStp('AddTaskOrgRelationship', {
      toRelationship: arguments[0]
    });
  }

  /**
   * Request that a Task Org Relationship be updated by STP. The actual update should only happen when STP responds with TaskOrgRelationshipModified
   * @param poid Unique identifier of the Task Org Relationship to update
   * @param toRelationship Task Org Relationship to be updated
   */
  updateTaskOrgRelationship(poid: string, toUnit: StpType.StpTaskOrgRelationship) {
    this.informStp('UpdateTaskOrgRelationship', {
      poid: arguments[0],
      toRelationship: arguments[1]
    });
  }

  /**
   * Request a Task Org Relationship deletion from STP. The actual removal should only happen when STP responds with TaskOrgRelationshipDeleted
   * @param poid Unique identifier of the Task Org Relationship to delete
   */
  deleteTaskOrgRelationship(poid: string) {
    this.informStp('DeleteTaskOrgRelationship', {
      poid: arguments[0]
    });
  }

  /**
   * Return the task organizations (ORBATs) defined in the current scenario, as summaries rather than full contents.
   * @param timeout - Optional timeout in seconds
   * @returns Array of TO summaries
   */
  async getScenarioTaskOrgList(timeout?: number): Promise<StpType.StpTaskOrg[]> {
    return this.requestStp('GetScenarioTaskOrgList', null, timeout);
  }

  /**
   * Return the objects making up a task organization as a plain array. This is a synonym of
   * getTaskOrgObjectSet - both reach the same engine call and return the same array; the two
   * spellings exist because the .NET SDK grew both.
   * @param poid - Task organization unique id
   * @param timeout - Optional timeout in seconds
   * @returns Array of task org objects
   */
  async getTaskOrgObjects(poid: string, timeout?: number): Promise<StpType.StpItem[]> {
    return this.requestStp('GetTaskOrgObjects', {
      poid: arguments[0],
    }, timeout);
  }
  //#endregion

  //#region Task commands
  /**
   * Request that a task be added by STP. The actual addition should only happen when STP responds with TaskAdded
   * @param task Task to add
   */
  addTask(task: StpType.StpTask) {
    this.informStp('AddTask', {
      task: arguments[0]
    });
  }

  /**
   * Request that a task be updated by STP. The actual update should only happen when STP responds with TaskModified
   * @param poid Unique identifier of the task to update
   * @param alternates Alternates of the task to update - normally only one of the alternates will have been modified 
   */
  updateTask(poid: string, alternates: StpType.StpTask[]) {
    this.informStp('UpdateTask', {
      poid: arguments[0],
      alternates: arguments[1]
    });
  }

  /**
   * Request a task deletion from STP. The actual removal should only happen when STP responds with TaskDeleted
   * @param poid Unique identifier of the task to delete
   */
  deleteTask(poid: string) {
    this.informStp('DeleteTask', {
      poid: arguments[0]
    });
  }

  /**
   * Pick an alternate as the confirmed task. The STP runtime responds with a task update notification
   * in which uiStatus is set to 'confirmed'
   * @param poid Unique identifier of the task for which an alternate is being confirmed
   * @param nBestIndex Index indicating which of the current alternates is selected for confirmation
   * @param [isConfirmed=true] True (default) if swithing task to confirmed status, false back to confirming
   */
  confirmTask(poid: string, nBestIndex: number, isConfirmed: boolean = true) {
    this.informStp('ConfirmTask', {
      poid: arguments[0],
      nBestIndex: arguments[1],
      isConfirmed: arguments[2]
    });
  }
  //#endregion

  //#region COA commands
  /**
   * Set TO to use when a particular COA is selected, or globally, when any COA (of the corresponding affiliation)
   * is selected
   * @param toPoid - Unique id of the TO to set
   * @param coaPoid - Unique Id of the COA the TO should be associated with - global default if undefined
   * @param timeout - Optional timeout in seconds
   */
  async setCoaTaskOrg(toPoid: string, coaPoid?: string, timeout?: number): Promise<void> {
    return this.requestStp('SetCoaTaskOrg', {
      toPoid: arguments[0],
      coaPoid: arguments[1],
    }, timeout);
  }

  /**
   * Remove TO association from a particular COA
   * @param affiliation - affiliation of the TO to reset as the default
   * @param coaPoid - Unique Id of the COA in which the TO should be reset - global default if undefined
   * @param timeout - Optional timeout in seconds
   */
  async resetCoaTaskOrg(coaPoid?: string, timeout?: number): Promise<void> {
    return this.requestStp('SetCoaTaskOrg', {
      affiliation: arguments[0],
      coaPoid: arguments[1],
    }, timeout);
  }
  /**
   * Import a new COA into the scenario
   * The COA is imported with a new unique Ids, i.e., the content is used as a template
   * That includes the Id of the COA definition as well as the individual symbols's
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   * @returns New COA's unique id
   */
  async importCoaContent(toContent: string, timeout?: number): Promise<string> {
    return this.requestStp('ImportCoaContent', {
      content: arguments[0],
    }, timeout);
  }

  /**
   *Get a COA content as a multiline string ready to be persisted
   * @param poid -COA's unique id
   * @param timeout - Optional timeout in seconds
   */
  async getCoaContent(poid: string, timeout?: number): Promise<string> {
    return this.requestStp('GetCoaContent', {
      poid: arguments[0],
    }, timeout);
  }

  /**
   * Select the current COA - edits and data imports are made into this COA henceforth
   * @param poid - COA's unique id
   * @param timeout - Optional timeout in seconds
   */
  async setCurrentCoa(poid: string, timeout?: number): Promise<void> {
    return this.requestStp('SetCurrentCoa', {
      poid: arguments[0],
    }, timeout);
  }

  /**
   * Add a new COA to the scenario
   * @param coa - COA to add 
   */
  addCoa(coa: StpType.StpCoa) {
    this.informStp('AddCoa', {
      coa: arguments[0],
    });
  }

  /**
   * Update COA definition
   * @param poid 
   * @param coa - updated COA
   */
  updateCoa(poid: string, coa: StpType.StpCoa) {
    this.informStp('UpdateCoa', {
      poid: arguments[0],
      coa: arguments[1],
    });
  }

  /**
   * Delete COA from scenario
   * @param poid 
   */
  deleteCoa(poid: string) {
    this.informStp('DeleteCoa', {
      poid: arguments[0],
    });
  }
  //#endregion

  //#region Role commands
  /**
 * Switch the role associated with the current COA 
 * @param role
 * @param createIfNone - true causes a default COA to be created for the desired role if none exists yet
 * @param timeout - Optional timeout in seconds
 */
  async setCurrentRole(role: StpType.StpRole, createIfNone: boolean = true, timeout?: number): Promise<void> {
    return this.requestStp('SetRole', {
      role: arguments[0],
    }, timeout);
  }

  /**
   * Clear the role previously set with setCurrentRole, returning this client to the default role. Fire and forget.
   */
  resetRole(): void {
    this.informStp('ResetRole', null);
  }
  //#endregion

  //#region Client and viewport commands
  /**
   * Tell STP which geographic area this client is currently showing, so recognition can be
   * biased towards what the user can actually see. Fire and forget.
   * @param topLeft - North-west corner of the visible map
   * @param botRight - South-east corner of the visible map
   */
  advertiseViewport(topLeft: StpType.LatLon, botRight: StpType.LatLon): void {
    this.informStp('AdvertiseViewport', {
      topLeft: arguments[0],
      botRight: arguments[1]
    });
  }

  /**
   * Enable or disable automatic tasking, in which STP infers tasks from symbols without an explicit spoken task. Fire and forget.
   * @param isEnabled - True to enable automatic tasking.
   */
  setAutoTasking(isEnabled: boolean): void {
    this.informStp('SetAutoTasking', {
      isEnabled: arguments[0]
    });
  }

  /**
   * Undo the last operation applied to an object. STP replays the effect as ordinary events
   * carrying isUndo = true, so a client that already handles the Added/Modified/Deleted events
   * needs no extra handling. Fire and forget.
   * @param poid - Unique id of the object whose last operation is to be undone.
   */
  undoLastOp(poid: string): void {
    this.informStp('UndoLastOp', {
      poid: arguments[0]
    });
  }
  //#endregion

  //#region Handlers - Speech and pen events
  /**
   * A pen down action was performed by a user
   * @param time - Pen down time
   * @param coord - Pen down map coordinate
   */
  onPenDown: ((time: Date, coord: StpType.LatLon) => void) | undefined;
  //onPenUp: (time: Date, coord: LatLon) => void;

  // Housekeeping
  /**
   * Sketched gestures have either been processed, or failed to process and can be cleared of the UI
   */
  onInkProcessed: (() => void) | undefined;

  /**
   * A new scenario has been created or loaded, replacing any previous content
   */
  onNewScenario: (() => void) | undefined;

  /**
   * User speech was successfully transcribed
   * @param phrases - Phrases that were recognized
   */
  onSpeechRecognized: ((phrases: string[]) => void) | undefined;

  /**
   * User speech input was discarded rather than integrated (e.g. did not match any grammar)
   */
  onSpeechDiscarded: (() => void) | undefined;

  /**
   * User speech was parsed against the grammar, producing ranked alternates
   * @param alternates - Speech recognition alternates that matched the grammar
   */
  onSpeechParsed: ((alternates: ISpeechRecoItem[]) => void) | undefined;

  //#endregion

  //#region Handlers - Symbol operations
  /**
   * A new symbol has been added
   * @param alternates - One or more symbol interpretations, ranked by likelihood
   * @param isUndo - True if this is the result of an undo operation (of a symbol delete)
   */
  onSymbolAdded:
    | ((alternates: StpType.StpSymbol[], isUndo: boolean) => void)
    | undefined;
  /**
   * A symbol has been modified
   * @param poid - Unique symbol identifier of the modified symbol
   * @param symbol - Symbol added
   * @param isUndo - True if this is the result of an undo operation (of a symbol modify)
   */
  onSymbolModified:
    | ((poid: string, symbol: StpType.StpSymbol, isUndo: boolean) => void)
    | undefined;
  /**
   * A symbol has been deleted
   * @param poid - Unique symbol identifier of the deleted symbol
   * @param isUndo - True if this is the result of an undo operation (of a symbol add)
   */
  onSymbolDeleted: ((poid: string, isUndo: boolean) => void) | undefined;
  /**
   * An update report for a symbol has been received, e.g from C2SIM
   * @param poid - Unique symbol identifier of the updated symbol
   * @param symbol - Updated symbol properties
   */
  onSymbolReport:
    | ((poid: string, symbol: StpType.StpSymbol) => void)
    | undefined;
  //#endregion

  //#region Handlers - Task Org operations
  /**
   * A new task org  has been added
   * @param  -  Added TO
   * @param isUndo - True if this is the result of an undo operation (of a TO delete)
   */
  onTaskOrgAdded:
    | ((taskOrg: StpType.StpTaskOrg, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org  has been modified
   * @param poid - Unique symbol identifier of the modified symbol
   * @param taskOrg - Modified TO
   * @param isUndo - True if this is the result of an undo operation (of a TO modify)
   */
  onTaskOrgModified:
    | ((poid: string, taskOrg : StpType.StpTaskOrg, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org  has been deleted
   * @param poid - Unique identifier of the deleted TO 
   * @param isUndo - True if this is the result of an undo operation (of a TO add)
   */
  onTaskOrgDeleted: ((poid: string, isUndo: boolean) => void) | undefined;

  /**
   * A new task org unit has been added
   * @param unit - Unit added
   * @param isUndo - True if this is the result of an undo operation (of a to unit delete)
   */
  onTaskOrgUnitAdded:
    | ((unit: StpType.StpTaskOrgUnit, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org unit has been modified
   * @param poid - Unique symbol identifier of the modified symbol
   * @param unit - Unit added
   * @param isUndo - True if this is the result of an undo operation (of a to unit modify)
   */
  onTaskOrgUnitModified:
    | ((poid: string, unit: StpType.StpTaskOrgUnit, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org unit has been deleted
   * @param poid - Unique identifier of the deleted to unit
   * @param isUndo - True if this is the result of an undo operation (of a to unit add)
   */
  onTaskOrgUnitDeleted: ((poid: string, isUndo: boolean) => void) | undefined;

  /**
   * A new task org relationship has been added
   * @param rel - Relationship added
   * @param isUndo - True if this is the result of an undo operation (of a to unit delete)
   */
  onTaskOrgRelationshipAdded:
    | ((rel: StpType.StpTaskOrgRelationship, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org relationship has been modified
   * @param poid - Unique identifier of the modified to relationship
   * @param rel - Relationship added
   * @param isUndo - True if this is the result of an undo operation (of a to unit modify)
   */
  onTaskOrgRelationshipModified:
    | ((poid: string, rel: StpType.StpTaskOrgRelationship, isUndo: boolean) => void)
    | undefined;
  /**
   * A task org relationship has been deleted
   * @param poid - Unique identifier of the deleted to relationship
   * @param isUndo - True if this is the result of an undo operation (of a to unit add)
   */
  onTaskOrgRelationshipDeleted: ((poid: string, isUndo: boolean) => void) | undefined;

  /**
   * A new task org has become current/active
   * @param taskOrg
   */
  onTaskOrgSwitched: ((taskOrg: StpType.StpTaskOrg) => void) | undefined;
  //#endregion

  //#region Handlers - Task operations
  /**
   *  A new task has been added
   * @param poid - Unique identifier of the added task
   * @param alternates - Ranked collection of alternate task interpretations
   * @param isUndo - True if this is the result of an undo operation (of a to unit add)
   */
  onTaskAdded:
    | ((poid: string, alternates: StpType.StpTask[], taskPoids: string[], isUndo: boolean) => void)
    | undefined;
  /**
   * A task has been modified
   * @param poid - Unique identifier of the modified task
   * @param alternates - Ranked collection of alternate task interpretations
   * @param isUndo - True if this is the result of an undo operation (of a to unit add)
   */
  onTaskModified:
    | ((poid: string, alternates: StpType.StpTask[], taskPoids: string[], isUndo: boolean) => void)
    | undefined;
  /**
   * A task has been deleted
   * @param poid - Unique identifier of the deleted task
   * @param isUndo - True if this is the result of an undo operation (of a to unit add)
   */
  onTaskDeleted: ((poid: string, isUndo: boolean) => void) | undefined;
  //#endregion

  //#region Handlers - COA operations
  /**
   * A new COA has been added
   * @param poid - Unique identifier of the added COA
   * @param coa - Definition of COA to add
   * @param isUndo - True if this is the result of an undo operation (of a to COA delete)
   */
  onCoaAdded:
    | ((poid: string, coa: StpType.StpCoa, isUndo: boolean) => void)
    | undefined;
  /**
   * A COA has been modified
   * @param poid - Unique identifier of the added COA
   * @param coa - Modified COA definition
   * @param isUndo - True if this is the result of an undo operation (of a to COA modify)
   */
  onCoaModified:
    | ((poid: string, coa: StpType.StpCoa, isUndo: boolean) => void)
    | undefined;
  /**
   * A COA has been deleted
   * @param poid - Unique identifier of the added COA
   * @param isUndo - True if this is the result of an undo operation (of a to COA add)
   */
  onCoaDeleted: ((poid: string, isUndo: boolean) => void) | undefined;
  /**
   * A new COA has become current/active
   * @param coa
   */
  onCoaSwitched: ((coa: StpType.StpCoa) => void) | undefined;
  //#endregion

  //#region Handlers - Role operations
  /**
   * A new role has become current/active
   * @param role
   */
  onRoleSwitched: ((role: StpType.StpRole) => void) | undefined;
  //#endregion

  //#region Handlers - Map/edit operations
  /**
   * A symbol edit operation (such as select) has been detected
   * Notice that Delete, Move and attribute editing operations are automatically handled by STP
   * These are just events tht require action from the client UI
   * @param operation - 'select' | other custom operations
   * @param location - associated gesture (point, line, area)
   */
  onSymbolEdited: ((operation: string, location: StpType.Location) => void) | undefined;
  
  /**
   * Map operation (such as pan, zoom) has been detected
   * @param operation - 'pan' | 'zoom'| ...
   * @param location - associated gesture (point, line, area)
   */
  onMapOperation: ((operation: string, location: StpType.Location) => void) | undefined;

  /**
   * Custom operation has been detected
   * @param operation - as defined in the Edits configuration table
   * @param location - associated gesture (point, line, area)
   */
  onCommand: ((operation: string, location: StpType.Location) => void) | undefined;
  //#endregion


  //#region Stp raised notifications
  /**
   * Message indicating an STP issue or event to be displayed to the user
   * @param msg - Message describing the issue
   * @param level - Type of message (see the corresponding enum)
   */
  onStpMessage:
    | ((msg: string, level: StpType.StpMessageLevel) => void)
    | undefined;
  //#endregion

  //#region Utility functions
  /**
  * Limits the amount of time a promise has to resolve/reject
  * @param timeout Timeout in seconds
  * @param promise Promise that will be aborted if timeout is exceeded
  */
  private promiseWithTimeout<T>(
    timeout: number,
    promise: Promise<T>
  ): Promise<T | any> {
    // Returns the promise that first resolves/rejects - that bounds the execution time to be that of the timeout,
    // as that would "win the race" and force a rejection error in case the other promise still did not produce results
    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        let id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('Operation timed out'));
        }, timeout * 1000);
      })
    ]);
  }
  //#endregion
}

export default StpRecognizer;
