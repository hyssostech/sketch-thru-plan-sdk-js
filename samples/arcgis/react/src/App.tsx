import { useEffect, useRef, useState, type ReactNode } from 'react';
import { startStpApp } from './stp-app';

/* ── Reusable accordion section ──────────────────────────────────────────── */
function AccordionSection({
  heading,
  subtitle,
  subtitleColor,
  expanded,
  onToggle,
  children,
}: {
  heading: string;
  subtitle?: string;
  subtitleColor?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`accordion-section${expanded ? ' expanded' : ''}`}>
      <button className="accordion-header" onClick={onToggle} type="button">
        <span className="accordion-icon">{expanded ? '▾' : '▸'}</span>
        {heading}
        {subtitle && <span className="accordion-subtitle" style={subtitleColor ? { color: subtitleColor } : undefined}>{subtitle}</span>}
      </button>
      <div className="accordion-content" style={{ display: expanded ? 'block' : 'none' }}>{children}</div>
    </div>
  );
}

/* ── Main application shell ──────────────────────────────────────────────── */
export default function App() {
  const initialized = useRef(false);
  const [message, setMessage] = useState('Connect to load map');
  const [messageColor, setMessageColor] = useState('black');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);

  // Header subtitle state
  const [toLabel, setToLabel] = useState('');
  const [toColor, setToColor] = useState('');
  const [activeRole, setActiveRole] = useState('');

  // Accordion open/close state
  const [connOpen, setConnOpen] = useState(true);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [c2simOpen, setC2simOpen] = useState(false);

  // Auto-toggle accordion sections on connection
  useEffect(() => {
    if (connected) {
      setConnOpen(false);
      setScenarioOpen(true);
    }
  }, [connected]);

  // Wire the log, busy & connected callbacks so React can display state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    startStpApp(
      (msg: string, color: string) => {
        setMessage(msg);
        setMessageColor(color);
      },
      (isBusy: boolean) => {
        setBusy(isBusy);
      },
      (isConnected: boolean) => {
        setConnected(isConnected);
      },
      (name: string, affiliation: string) => {
        setToLabel(name === 'none' ? '' : name);
        const colorMap: Record<string, string> = { friend: '#005e95', hostile: '#c7461a' };
        setToColor(colorMap[affiliation] ?? '#6e6e6e');
      },
      (role: string) => {
        setActiveRole(role === 'none' ? '' : role.toUpperCase());
      }
    );
  }, []);

  return (
    <>
      {/* ── Full-bleed map ──────────────────────────────────── */}
      <div id="map"></div>

      {/* ── Floating control panel ──────────────────────────── */}
      <div className={`panel${panelMinimized ? ' minimized' : ''}`}>
        <div className="panel-header">
          <span className="panel-title">STP Controls</span>
          <button
            className="panel-toggle"
            type="button"
            onClick={() => setPanelMinimized(p => !p)}
            title={panelMinimized ? 'Expand panel' : 'Minimize panel'}
          >
            {panelMinimized ? '▶' : '◀'}
          </button>
        </div>

        <div className="panel-body" style={{ display: panelMinimized ? 'none' : 'block' }}>
        {/* Connection */}
        <AccordionSection
          heading="Connection"
          subtitle={connected ? 'Connected' : undefined}
          subtitleColor={connected ? '#2d8659' : undefined}
          expanded={connOpen}
          onToggle={() => setConnOpen(p => !p)}
        >
          <div className="control-row">
            <label htmlFor="sessionId">Session</label>
            <input type="text" id="sessionId" className="text-input" placeholder="auto" />
          </div>
          <div className="control-row">
            <button id="connect" className="btn btn-primary" type="button">Connect</button>
            <span id="status" className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </AccordionSection>

        {/* Scenario */}
        <AccordionSection heading="Scenario" expanded={scenarioOpen} onToggle={() => setScenarioOpen(p => !p)}>
          <div className="button-grid">
            <button id="new" className="btn" type="button" disabled={!connected}>New</button>
            <button id="join" className="btn" type="button" disabled={!connected}>Join</button>
            <button id="save" className="btn" type="button" disabled={!connected}>Save</button>
            <button id="load" className="btn" type="button" disabled={!connected}>Load</button>
            <button id="sync" className="btn" type="button" disabled={!connected}>Sync</button>
          </div>
        </AccordionSection>

        {/* TO / ORBAT */}
        <AccordionSection
          heading="TO / ORBAT"
          subtitle={toLabel || undefined}
          subtitleColor={toColor || undefined}
          expanded={toOpen}
          onToggle={() => setToOpen(p => !p)}
        >
          <div className="button-grid">
            <button id="friend" className="btn" type="button" disabled={!connected}>Load Friend</button>
            <button id="hostile" className="btn" type="button" disabled={!connected}>Load Hostile</button>
          </div>
          <div className="control-row to-active">
            <span className="field-label">Active:</span>
            <span id="toName">none</span>
            <button id="getto" className="btn btn-sm" type="button" disabled={!connected}>Save</button>
          </div>
        </AccordionSection>

        {/* Role */}
        <AccordionSection
          heading="Role"
          subtitle={activeRole || undefined}
          expanded={roleOpen}
          onToggle={() => setRoleOpen(p => !p)}
        >
          <div className="control-row">
            <select id="roles" name="roles" className="select-input" disabled={!connected}>
              <option value="none">None</option>
              <option value="s2">S2</option>
              <option value="s3">S3</option>
              <option value="s4">S4</option>
              <option value="fso">FSO</option>
              <option value="eng">ENG</option>
            </select>
          </div>
        </AccordionSection>

        {/* C2SIM */}
        <AccordionSection heading="C2SIM" expanded={c2simOpen} onToggle={() => setC2simOpen(p => !p)}>
          <div className="control-row">
            <button id="export" className="btn" type="button" disabled={!connected}>Export</button>
            <select id="affiliation" name="affiliation" className="select-input" disabled={!connected}>
              <option value="all">all</option>
              <option value="friend">friend</option>
              <option value="hostile">hostile</option>
            </select>
            <select id="types" name="types" className="select-input" disabled={!connected}>
              <option value="Initialization">Initialization</option>
              <option value="Order">Order</option>
            </select>
          </div>
          <div className="control-row">
            <button id="import" className="btn" type="button" disabled={!connected}>Import</button>
            <span id="importGroup" className="field-label">Initialization</span>
          </div>
        </AccordionSection>
        </div>{/* end panel-body */}
      </div>

      {/* ── Floating message bar ────────────────────────────── */}
      <div id="messages" className="message-overlay" style={{ color: messageColor }}>
        {busy && <span className="spinner" />}
        {message}
      </div>
    </>
  );
}
