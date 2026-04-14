// =============================================================================
// CHAINSIGHT — Prescription Generator
// ASSUMPTIONS:
//   1. Always outputs EXACTLY 2 prescriptions: ALT_SUPPLIER + INVENTORY_BUFFER.
//   2. ALT_SUPPLIER candidate: highest health_score T3/BN node not in the
//      disrupted path. If ALL T3/BN nodes are in path, select least-affected.
//   3. INVENTORY_BUFFER uses max days_to_impact across all affected nodes.
//      If no nodes are affected, fallback = FALLBACK_BUFFER_DAYS.
//   4. Score formula (spec): score = severity_blocked×0.5 + speed_of_action×0.3
//      + cost_efficiency×0.2
//   5. Tie-break order: speed_of_action DESC → node_id/type ASC (alpha).
//      (error rule #5)
// =============================================================================

// --- CONSTANTS ---------------------------------------------------------------
const SCORE_WEIGHTS = Object.freeze({
  severity_blocked: 0.50,
  speed_of_action:  0.30,
  cost_efficiency:  0.20,
});

const PRESCRIPTION_TYPE = Object.freeze({
  ALT_SUPPLIER:     'ALT_SUPPLIER',
  INVENTORY_BUFFER: 'INVENTORY_BUFFER',
});

const BUFFER_FACTOR          = 0.60;   // buffer_days = days_to_impact × BUFFER_FACTOR
const FALLBACK_BUFFER_DAYS   = 30;     // used when no affected nodes found
const ALT_SPEED_OF_ACTION    = 0.40;   // qualifying an alt supplier takes time
const ALT_COST_EFFICIENCY    = 0.50;   // medium cost
const BUF_SPEED_OF_ACTION    = 0.80;   // fast — just stock up
const BUF_COST_EFFICIENCY    = 0.30;   // ties up working capital
const SCORE_DECIMALS         = 4;

// --- HELPERS -----------------------------------------------------------------
function scoreOption(severity_blocked, speed_of_action, cost_efficiency) {
  const s = (
    severity_blocked * SCORE_WEIGHTS.severity_blocked +
    speed_of_action  * SCORE_WEIGHTS.speed_of_action  +
    cost_efficiency  * SCORE_WEIGHTS.cost_efficiency
  );
  return parseFloat(s.toFixed(SCORE_DECIMALS));
}

/**
 * Rank prescriptions descending by score.
 * Tie-break: speed_of_action DESC → sort key ASC (alphabetical) [error rule #5]
 */
function rankPrescriptions(list) {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.details.speed_of_action !== a.details.speed_of_action)
      return b.details.speed_of_action - a.details.speed_of_action;
    const keyA = a.recommended_node || a.type;
    const keyB = b.recommended_node || b.type;
    return keyA.localeCompare(keyB);
  });
}

// --- MAIN FUNCTION -----------------------------------------------------------
/**
 * Generate exactly 2 ranked mitigation prescriptions.
 * @param {{ nodes: object[], edges: object[] }} graphState
 * @param {{ disrupted_node: string, affected_nodes: object[] }} rippleData
 * @param {{ node_id: string, severity: number }} disruption
 * @returns {{ ok: boolean, data: object|null, error: string|null }}
 */
export function generatePrescriptions(graphState, rippleData, disruption) {
  try {
    // ── Input guard ──────────────────────────────────────────────────────────
    if (!graphState) {
      throw new Error(
        `FATAL: generatePrescriptions returned null — input was: ${JSON.stringify(graphState)}`
      );
    }
    if (!rippleData) {
      throw new Error(
        `FATAL: generatePrescriptions returned null — input was: ${JSON.stringify(rippleData)}`
      );
    }
    if (!disruption) {
      throw new Error(
        `FATAL: generatePrescriptions returned null — input was: ${JSON.stringify(disruption)}`
      );
    }

    const { nodes }                         = graphState;
    const { disrupted_node, affected_nodes } = rippleData;

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { ok: false, data: null, error: 'graphState.nodes is empty or invalid.' };
    }

    // ── Build disrupted path set ─────────────────────────────────────────────
    const disruptedPath = new Set([
      disrupted_node,
      ...(affected_nodes || []).map(n => n.node_id),
    ]);

    // ── Prescription 1: ALT_SUPPLIER ─────────────────────────────────────────
    const allT3BN     = nodes.filter(n => n.tier === 'T3' || n.tier === 'BN');
    const candidates  = allT3BN.filter(n => !disruptedPath.has(n.id));

    let altNode;
    if (candidates.length > 0) {
      // Prefer highest health outside disrupted path
      altNode = candidates.sort((a, b) => b.health_score - a.health_score)[0];
    } else {
      // All T3/BN affected — use least-impacted (highest remaining health)
      altNode = allT3BN.sort((a, b) => b.health_score - a.health_score)[0];
      console.warn(
        'WARN: generatePrescriptions — all T3/BN nodes in disrupted path. ' +
        `Using least-affected: ${altNode?.id}`
      );
    }

    if (!altNode) {
      throw new Error(
        'FATAL: generatePrescriptions returned null — input was: no T3/BN nodes found in graph'
      );
    }

    const altSeverityBlocked = parseFloat((disruption.severity * altNode.health_score).toFixed(3));
    const altScore           = scoreOption(altSeverityBlocked, ALT_SPEED_OF_ACTION, ALT_COST_EFFICIENCY);

    const altSupplier = {
      type:             PRESCRIPTION_TYPE.ALT_SUPPLIER,
      rank:             null, // assigned after sort
      score:            altScore,
      recommended_node: altNode.id,
      node_name:        altNode.name,
      node_country:     altNode.country,
      node_health:      altNode.health_score,
      description:      `Activate alternate supplier: ${altNode.name} (${altNode.country}) — health ${(altNode.health_score * 100).toFixed(0)}%`,
      details: {
        severity_blocked: altSeverityBlocked,
        speed_of_action:  ALT_SPEED_OF_ACTION,
        cost_efficiency:  ALT_COST_EFFICIENCY,
      },
    };

    // ── Prescription 2: INVENTORY_BUFFER ─────────────────────────────────────
    const maxDays = (affected_nodes && affected_nodes.length > 0)
      ? Math.max(...affected_nodes.map(n => n.days_to_impact))
      : FALLBACK_BUFFER_DAYS;

    const bufferDays         = Math.ceil(maxDays * BUFFER_FACTOR);
    const bufSeverityBlocked = parseFloat((disruption.severity * 0.70).toFixed(3));
    const bufScore           = scoreOption(bufSeverityBlocked, BUF_SPEED_OF_ACTION, BUF_COST_EFFICIENCY);

    const inventoryBuffer = {
      type:         PRESCRIPTION_TYPE.INVENTORY_BUFFER,
      rank:         null,
      score:        bufScore,
      buffer_days:  bufferDays,
      description:  `Build ${bufferDays}-day safety stock — covers ${(BUFFER_FACTOR * 100).toFixed(0)}% of worst-case lead time (${maxDays.toFixed(1)} days to OEM impact)`,
      details: {
        severity_blocked:   bufSeverityBlocked,
        speed_of_action:    BUF_SPEED_OF_ACTION,
        cost_efficiency:    BUF_COST_EFFICIENCY,
        max_days_to_impact: parseFloat(maxDays.toFixed(1)),
        buffer_factor:      BUFFER_FACTOR,
      },
    };

    // ── Rank & validate ───────────────────────────────────────────────────────
    const ranked = rankPrescriptions([altSupplier, inventoryBuffer]).map((p, i) => ({
      ...p, rank: i + 1,
    }));

    if (ranked.length !== 2) {
      throw new Error(
        `FATAL: generatePrescriptions returned null — expected exactly 2 prescriptions, got ${ranked.length}`
      );
    }

    return {
      ok:    true,
      data:  { prescriptions: ranked, generated_at: Date.now() },
      error: null,
    };
  } catch (err) {
    console.error('FATAL: generatePrescriptions failed:', err.message);
    return { ok: false, data: null, error: err.message };
  }
}

export { PRESCRIPTION_TYPE, SCORE_WEIGHTS, BUFFER_FACTOR };
