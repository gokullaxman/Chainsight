// =============================================================================
// CHAINSIGHT — Control Panel Component
// ASSUMPTIONS:
//   1. Form severity is kept as a float (0–1) in state. Displayed as 0–100%.
//   2. "Trigger" button is disabled while a disruption is active, preventing
//      double-triggering. User must click Reset before injecting a new one.
//   3. NODES is imported from graphData for the node picker.
//      BN_1 appears as "[T3] Apex Critical Supplies" (tier hidden).
//   4. Prescription score detail rows only render the 3 spec-defined fields
//      (severity_blocked, speed_of_action, cost_efficiency); extra fields
//      such as buffer_factor are omitted from display for clarity.
// =============================================================================

import React, { useState, useCallback } from 'react';
import { useChain }             from '../store/chainStore';
import { NODES }                from '../data/graphData';
import { VALID_EVENT_TYPES }    from '../engine/disruption';
import { PRESCRIPTION_TYPE }    from '../engine/prescriptions';

// --- CONSTANTS ---------------------------------------------------------------
const DEFAULT_NODE_ID   = 'BN_1';
const DEFAULT_EVENT     = 'FIRE';
const DEFAULT_SEVERITY  = 0.75;
const DEFAULT_START_DAY = 1;

const RX_ICONS = Object.freeze({
  [PRESCRIPTION_TYPE.ALT_SUPPLIER]:     '',
  [PRESCRIPTION_TYPE.INVENTORY_BUFFER]: '',
});

const SCORE_DETAIL_KEYS = Object.freeze([
  'severity_blocked', 'speed_of_action', 'cost_efficiency',
]);

// --- SUB-COMPONENTS ----------------------------------------------------------
function SectionLabel({ text, color = 'text-cs-text' }) {
  return (
    <h2 className={`text-xs font-semibold ${color} mb-3`}>
      {text}
    </h2>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="text-[9px] bg-cs-bg rounded px-1.5 py-0.5 border border-cs-border/60">
      <span className="text-cs-muted">{label.replace(/_/g, ' ')}: </span>
      <span className="text-cs-text font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </div>
  );
}

// --- MAIN COMPONENT ----------------------------------------------------------
export default function ControlPanel() {
  const { state, injectDisruption, reset } = useChain();
  const { disruption, rippleResult, prescriptions, error } = state;

  const [form, setForm] = useState({
    node_id:   DEFAULT_NODE_ID,
    event_type: DEFAULT_EVENT,
    severity:  DEFAULT_SEVERITY,
    start_day: DEFAULT_START_DAY,
  });

  const set = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleTrigger = useCallback(() => {
    const d = {
      node_id:   form.node_id,
      event_type: form.event_type,
      severity:  parseFloat(form.severity),
      start_day: Math.max(0, parseInt(form.start_day, 10) || 0),
    };
    if (!d.node_id || !d.event_type) {
      console.error('FATAL: handleTrigger returned null — input was: incomplete form', d);
      return;
    }
    injectDisruption(d);
  }, [form, injectDisruption]);

  const isActive = !!disruption;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Disruption Form ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionLabel text="Test an issue" color="text-cs-red" />

        {/* Node picker */}
        <label className="block mb-3">
          <span className="text-[10px] text-cs-muted uppercase tracking-wider mb-1.5 block">
            Target Node
          </span>
          <select
            id="sel-target-node"
            className="w-full bg-cs-bg border border-cs-border rounded-lg px-3 py-2 text-xs text-cs-text focus:outline-none focus:border-cs-teal transition-colors"
            value={form.node_id}
            onChange={e => set('node_id', e.target.value)}
            disabled={isActive}
          >
            {NODES.map(n => (
              <option key={n.id} value={n.id}>
                [{n.tier === 'BN' ? 'T3' : n.tier}] {n.name}
              </option>
            ))}
          </select>
        </label>

        {/* Event type */}
        <label className="block mb-3">
          <span className="text-[10px] text-cs-muted uppercase tracking-wider mb-1.5 block">
            Event Type
          </span>
          <select
            id="sel-event-type"
            className="w-full bg-cs-bg border border-cs-border rounded-lg px-3 py-2 text-xs text-cs-text focus:outline-none focus:border-cs-teal transition-colors"
            value={form.event_type}
            onChange={e => set('event_type', e.target.value)}
            disabled={isActive}
          >
            {VALID_EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>

        {/* Severity slider */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-cs-muted uppercase tracking-wider">Severity</span>
            <span
              id="lbl-severity"
              className="text-xs font-mono font-semibold"
              style={{ color: form.severity > 0.7 ? '#E24B4A' : form.severity > 0.4 ? '#BA7517' : '#1D9E75' }}
            >
              {(form.severity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            id="slid-severity"
            type="range" min="0" max="1" step="0.01"
            value={form.severity}
            onChange={e => set('severity', parseFloat(e.target.value))}
            disabled={isActive}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-cs-muted mt-0.5">
            <span>Minor</span><span>Critical</span>
          </div>
        </div>

        {/* Start day */}
        <label className="block mb-4">
          <span className="text-[10px] text-cs-muted uppercase tracking-wider mb-1.5 block">
            Start Day
          </span>
          <input
            id="inp-start-day"
            type="number" min="0"
            value={form.start_day}
            onChange={e => set('start_day', parseInt(e.target.value, 10) || 0)}
            disabled={isActive}
            className="w-full bg-cs-bg border border-cs-border rounded-lg px-3 py-2 text-xs text-cs-text font-mono focus:outline-none focus:border-cs-teal transition-colors"
          />
        </label>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            id="btn-trigger-disruption"
            onClick={handleTrigger}
            disabled={isActive}
            className="flex-1 text-xs font-bold rounded-lg px-4 py-2.5 transition-all
              bg-cs-red hover:bg-red-500 text-white
              disabled:opacity-35 disabled:cursor-not-allowed"
          >
            Trigger
          </button>
          <button
            id="btn-reset-graph"
            onClick={reset}
            className="flex-1 text-xs font-semibold rounded-lg px-4 py-2.5 transition-all
              bg-cs-border hover:bg-cs-panel text-cs-muted hover:text-cs-text"
          >
            Reset
          </button>
        </div>
      </section>

      {/* ── Error display ────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-8 text-[10px] font-mono text-cs-red">
          <div className="text-cs-red font-semibold mb-1">⚠ Engine Error</div>
          <div className="text-red-400 break-all leading-relaxed">{error}</div>
        </div>
      )}

      {/* ── Ripple Summary ───────────────────────────────────────────────── */}
      {rippleResult && (
        <section className="mb-8">
          <SectionLabel text="Impact summary" color="text-cs-amber" />
          {rippleResult.partial_result && (
            <span className="text-[9px] text-cs-red font-mono bg-red-950/40 px-1.5 py-0.5 rounded mb-2 inline-block">
              PARTIAL — MAX_HOPS reached
            </span>
          )}
          <div className="text-[10px] text-cs-muted mb-2">
            {rippleResult.total_affected} node{rippleResult.total_affected !== 1 ? 's' : ''} affected
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {rippleResult.affected_nodes.map(n => (
              <div
                key={n.node_id}
                className="flex items-center justify-between bg-cs-bg rounded-md px-2.5 py-1.5"
              >
                <span className="font-mono text-[10px] text-cs-text">{n.node_id}</span>
                <span className="text-[10px] text-cs-amber font-mono ml-auto mr-2">{n.days_to_impact}d</span>
                <span className="text-[10px] text-cs-red font-mono">{(n.severity_received * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Prescriptions ────────────────────────────────────────────────── */}
      {prescriptions && (
        <section className="mb-8">
          <SectionLabel text="Suggested actions" color="text-cs-teal" />
          <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <div
                key={rx.type}
                className={`py-3 transition-all ${
                  i === 0
                    ? 'border-l-2 border-cs-teal pl-3 -ml-3'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-cs-text">
                    #{rx.rank} {rx.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-cs-teal">
                    {rx.score.toFixed(4)}
                  </span>
                </div>
                <p className="text-[10px] text-cs-muted leading-relaxed mb-2">
                  {rx.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {SCORE_DETAIL_KEYS.map(k =>
                    rx.details[k] !== undefined
                      ? <MetricChip key={k} label={k} value={rx.details[k]} />
                      : null
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
