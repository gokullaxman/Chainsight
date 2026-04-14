// =============================================================================
// CHAINSIGHT — Disruption Engine
// ASSUMPTIONS:
//   1. graphState is a plain object { nodes: Node[], edges: Edge[] }.
//      It is treated as immutable — a new state is returned, original untouched.
//   2. "Freeze outbound edges" = edges where node is the SOURCE (supplier side).
//      A frozen edge blocks ripple propagation through that supply link.
//   3. health_score after disruption = (1 - severity), clamped to [0, 1].
// =============================================================================

// --- CONSTANTS ---------------------------------------------------------------
const VALID_EVENT_TYPES = Object.freeze([
  'FIRE', 'FLOOD', 'STRIKE', 'FINANCIAL_DISTRESS', 'PORT_CLOSURE',
]);
const MIN_SEVERITY = 0;
const MAX_SEVERITY = 1;
const MIN_START_DAY = 0;

// --- MAIN FUNCTION -----------------------------------------------------------
/**
 * Apply a disruption to a graph state.
 * @param {{ nodes: object[], edges: object[] }} graphState
 * @param {{ node_id: string, event_type: string, severity: number, start_day: number }} disruption
 * @returns {{ ok: boolean, data: object|null, error: string|null }}
 */
export function applyDisruption(graphState, disruption) {
  try {
    // ── Input guard ──────────────────────────────────────────────────────────
    if (!graphState || !graphState.nodes || !graphState.edges) {
      throw new Error(
        `FATAL: applyDisruption returned null — input was: ${JSON.stringify(graphState)}`
      );
    }
    if (!disruption) {
      throw new Error('FATAL: applyDisruption returned null — input was: null disruption');
    }

    const { node_id, event_type, severity, start_day } = disruption;

    if (!node_id || typeof node_id !== 'string' || node_id.trim() === '') {
      return { ok: false, data: null, error: 'Invalid node_id: must be a non-empty string.' };
    }
    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return {
        ok: false, data: null,
        error: `Invalid event_type "${event_type}". Allowed: ${VALID_EVENT_TYPES.join(', ')}.`,
      };
    }
    if (typeof severity !== 'number' || severity < MIN_SEVERITY || severity > MAX_SEVERITY) {
      return {
        ok: false, data: null,
        error: `Invalid severity "${severity}". Must be a number in [${MIN_SEVERITY}, ${MAX_SEVERITY}].`,
      };
    }
    if (typeof start_day !== 'number' || start_day < MIN_START_DAY) {
      return {
        ok: false, data: null,
        error: `Invalid start_day "${start_day}". Must be a non-negative number.`,
      };
    }

    const targetNode = graphState.nodes.find(n => n.id === node_id);
    if (!targetNode) {
      return { ok: false, data: null, error: `Node "${node_id}" not found in graph.` };
    }

    // ── Apply disruption (immutably) ─────────────────────────────────────────
    const newHealth = parseFloat(Math.max(0, 1 - severity).toFixed(3));

    const newNodes = graphState.nodes.map(n =>
      n.id !== node_id ? n : {
        ...n,
        health_score:        newHealth,
        disrupted:           true,
        disruption_event:    event_type,
        disruption_severity: severity,
        disruption_start_day: start_day,
      }
    );

    // Freeze all outbound edges from the disrupted node (supplier side)
    const newEdges = graphState.edges.map(e =>
      e.source !== node_id ? e : { ...e, frozen: true }
    );

    const result = { nodes: newNodes, edges: newEdges, disruption };

    if (!result) {
      throw new Error(`FATAL: applyDisruption returned null — input was: ${JSON.stringify(disruption)}`);
    }

    return { ok: true, data: result, error: null };
  } catch (err) {
    console.error('FATAL: applyDisruption failed:', err.message);
    return { ok: false, data: null, error: err.message };
  }
}

export { VALID_EVENT_TYPES };
