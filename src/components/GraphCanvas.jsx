// =============================================================================
// CHAINSIGHT — D3 Graph Canvas Component
// ASSUMPTIONS:
//   1. D3 owns the SVG DOM. React only renders the outer <svg> container.
//      React StrictMode double-mount is handled by nulling d3Refs in cleanup.
//   2. On D3 init/update failure (error rule #4): setFallback(true) triggers
//      the FallbackTable, a plain HTML table of affected nodes.
//   3. The simulation is initialised ONCE on mount with the pristine graph.
//      Disruptions update visual state only (colors, badges) — the force
//      layout positions do not change, avoiding jarring re-animation.
// =============================================================================

import React, { useRef, useEffect, useState } from 'react';
import { useChain } from '../store/chainStore';
import { initSimulation, updateGraph, resetGraph } from '../hooks/useGraphSimulation';

// --- CONSTANTS ---------------------------------------------------------------
const CANVAS_HEIGHT = 540;

const LEGEND = Object.freeze([
  { color: '#1D9E75', label: 'Healthy  > 70%',   key: 'teal'   },
  { color: '#BA7517', label: 'Stressed 40–70%',   key: 'amber'  },
  { color: '#E24B4A', label: 'Critical < 40%',    key: 'red'    },
  { color: '#534AB7', label: 'Bottleneck revealed',key: 'purple' },
]);

// --- FALLBACK TABLE (D3 render fails — error rule #4) ------------------------
function FallbackTable({ rippleResult, disruption }) {
  const rows = rippleResult?.affected_nodes ?? [];
  return (
    <div className="p-4 text-xs font-mono">
      <div className="text-cs-amber mb-2 font-semibold">
        ⚠ D3 renderer unavailable — displaying text fallback
      </div>
      {disruption && (
        <div className="text-cs-muted mb-2">
          Event: <span className="text-cs-red">{disruption.event_type}</span>{' '}
          on <span className="text-cs-text">{disruption.node_id}</span>{' '}
          (severity {(disruption.severity * 100).toFixed(0)}%)
        </div>
      )}
      {rows.length === 0
        ? <p className="text-cs-muted">No affected nodes.</p>
        : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-cs-muted border-b border-cs-border">
                <th className="py-1 pr-3">Node</th>
                <th className="py-1 pr-3">Days to Impact</th>
                <th className="py-1 pr-3">Severity</th>
                <th className="py-1">Path</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.node_id} className="border-b border-cs-border/40">
                  <td className="py-1 pr-3 text-cs-text">{r.node_id}</td>
                  <td className="py-1 pr-3 text-cs-amber">{r.days_to_impact}d</td>
                  <td className="py-1 pr-3 text-cs-red">{(r.severity_received * 100).toFixed(1)}%</td>
                  <td className="py-1 text-cs-muted text-[9px]">{r.path_taken.join(' → ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

// --- MAIN COMPONENT ----------------------------------------------------------
export default function GraphCanvas() {
  const { state }                             = useChain();
  const { nodes, edges, disruption, rippleResult } = state;

  const svgRef  = useRef(null);
  const d3Refs  = useRef(null);   // { simulation, nodeG, edgeG, nodeById }
  const [fallback, setFallback] = useState(false);

  // ── Mount: initialise D3 simulation ────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    try {
      const w = el.clientWidth  || 900;
      const h = el.clientHeight || CANVAS_HEIGHT;
      d3Refs.current = initSimulation(el, nodes, edges, w, h);
    } catch (err) {
      console.error('FATAL: GraphCanvas D3 init failed:', err.message);
      setFallback(true);
    }

    return () => {
      d3Refs.current?.simulation?.stop();
      d3Refs.current = null;   // allow re-init on StrictMode double-mount
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disruption / Reset: sync visual state ──────────────────────────────────
  useEffect(() => {
    if (!d3Refs.current) return;

    try {
      if (!disruption) {
        resetGraph(d3Refs.current, nodes);
      } else {
        updateGraph(d3Refs.current, nodes, edges, disruption, rippleResult);
      }
    } catch (err) {
      console.warn('WARN: GraphCanvas visual update failed — switching to fallback:', err.message);
      setFallback(true);
    }
  }, [nodes, edges, disruption, rippleResult]);

  // ── Fallback render ─────────────────────────────────────────────────────────
  if (fallback) {
    return <FallbackTable rippleResult={rippleResult} disruption={disruption} />;
  }

  // ── Normal render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col w-full h-full">

      {/* Legend bar */}
      <div className="flex items-center gap-5 px-5 py-2.5 flex-wrap border-b border-cs-border/50">
        {LEGEND.map(({ color, label, key }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span className="text-[10px] text-cs-muted">{label}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-cs-muted font-mono">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      {/* D3 canvas */}
      <svg
        ref={svgRef}
        className="flex-1 w-full"
        style={{ minHeight: `${CANVAS_HEIGHT}px`, background: 'transparent' }}
      />

      {/* Disruption overlay badge */}
      {disruption && (
        <div className="absolute top-12 right-4 glass-panel px-3 py-2.5 text-xs pointer-events-none select-none">
          <div className="text-cs-red font-semibold font-mono tracking-wide">
            {disruption.event_type}
          </div>
          <div className="text-cs-muted mt-0.5">
            {disruption.node_id} — sev {(disruption.severity * 100).toFixed(0)}%
          </div>
          <div className="text-cs-muted mt-0.5">
            Day {disruption.start_day}
          </div>
          {rippleResult && (
            <div className="text-cs-amber mt-1.5 font-mono">
              ↑ {rippleResult.total_affected} nodes impacted
            </div>
          )}
        </div>
      )}

      {/* Hint — shown before first disruption */}
      {!disruption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-cs-muted font-mono animate-pulse pointer-events-none">
          scroll to zoom · drag to pan
        </div>
      )}
    </div>
  );
}
