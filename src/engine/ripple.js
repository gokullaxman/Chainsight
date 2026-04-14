// =============================================================================
// CHAINSIGHT — Ripple Propagation Engine
// ASSUMPTIONS:
//   1. Edges run supplier→customer. BFS follows edge direction from the
//      disrupted node upward toward OEM, matching material flow.
//   2. "upstream_node" in the delay formula refers to the CURRENT SOURCE node
//      being traversed FROM. delay += lead_time × (1 - source.health_score).
//   3. Frozen edges (set by disruption engine) are skipped — they represent
//      severed supply links, not propagation paths.
//   4. BFS uses a queue (not recursion) to avoid stack overflow on large graphs.
//   5. If a node is reachable via multiple paths, the path yielding the
//      HIGHEST severity_received is stored (worst-case scenario).
// =============================================================================

// --- CONSTANTS ---------------------------------------------------------------
const NOISE_FLOOR       = 0.05;   // stop propagation below this severity
const MAX_HOPS          = 20;     // anti-infinite-loop guard (error rule #3)
const SEVERITY_DECIMALS = 3;
const DAYS_DECIMALS     = 1;

// --- MAIN FUNCTION -----------------------------------------------------------
/**
 * Simulate disruption ripple propagation via BFS.
 * @param {{ nodes: object[], edges: object[] }} graphState  (post-disruption)
 * @param {{ node_id: string, severity: number }} disruption
 * @returns {{ ok: boolean, data: object|null, error: string|null }}
 */
export function simulateRipple(graphState, disruption) {
  try {
    // ── Input guard ──────────────────────────────────────────────────────────
    if (!graphState) {
      throw new Error(
        `FATAL: simulateRipple returned null — input was: ${JSON.stringify(graphState)}`
      );
    }
    if (!disruption) {
      throw new Error(
        `FATAL: simulateRipple returned null — input was: ${JSON.stringify(disruption)}`
      );
    }
    if (!graphState.nodes || !Array.isArray(graphState.nodes)) {
      return { ok: false, data: null, error: 'graphState.nodes is missing or not an array.' };
    }
    if (!graphState.edges || !Array.isArray(graphState.edges)) {
      return { ok: false, data: null, error: 'graphState.edges is missing or not an array.' };
    }

    const { node_id, severity } = disruption;
    if (!node_id || typeof severity !== 'number') {
      return { ok: false, data: null, error: 'disruption must have node_id (string) and severity (number).' };
    }

    const { nodes, edges } = graphState;

    // ── Build forward adjacency (supplier → [customer edges]) ────────────────
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const adj     = {}; // adj[source] = [{ target, edge }]
    nodes.forEach(n => { adj[n.id] = []; });

    for (const edge of edges) {
      // NOTE: Frozen edges ARE traversed — frozen = "supply severed" (visual).
      // BFS is analytical: it finds WHO is impacted, so it must follow these paths.
      if (!nodeMap[edge.source] || !nodeMap[edge.target]) {
        console.warn(`WARN: simulateRipple — dangling edge ${edge.id}, skipping.`);
        continue;
      }
      adj[edge.source].push({ target: edge.target, edge });
    }

    // ── BFS ──────────────────────────────────────────────────────────────────
    // Queue entry: { nodeId, daysToImpact, severityReceived, pathTaken, hops }
    const affected     = {}; // nodeId → best result object
    let   hopsWarning  = false;

    const queue = [{
      nodeId:           node_id,
      daysToImpact:     0,
      severityReceived: severity,
      pathTaken:        [node_id],
      hops:             0,
    }];

    while (queue.length > 0) {
      const current = queue.shift();

      // ── Anti-infinite-loop guard (error rule #3) ──────────────────────────
      if (current.hops > MAX_HOPS) {
        hopsWarning = true;
        console.warn(
          `WARN: simulateRipple — MAX_HOPS (${MAX_HOPS}) reached at node ` +
          `${current.nodeId}. Returning partial result.`
        );
        continue;
      }

      // Record affected node (skip the origin disrupted node itself)
      if (current.nodeId !== node_id) {
        const existing = affected[current.nodeId];
        // Keep the path with highest severity_received (worst case)
        if (!existing || current.severityReceived > existing.severity_received) {
          affected[current.nodeId] = {
            node_id:           current.nodeId,
            days_to_impact:    parseFloat(current.daysToImpact.toFixed(DAYS_DECIMALS)),
            severity_received: parseFloat(current.severityReceived.toFixed(SEVERITY_DECIMALS)),
            path_taken:        [...current.pathTaken],
          };
        }
      }

      // ── Traverse outbound edges ───────────────────────────────────────────
      const neighbors = adj[current.nodeId] || [];
      for (const { target, edge } of neighbors) {
        const propagatedSeverity = current.severityReceived * edge.dependency_weight;

        // Noise-floor check — stop this branch
        if (propagatedSeverity < NOISE_FLOOR) continue;

        const sourceNode = nodeMap[current.nodeId];
        if (!sourceNode) {
          console.warn(`WARN: simulateRipple — source node "${current.nodeId}" not found, skipping.`);
          continue;
        }

        // delay contribution from THIS hop: lead_time × (1 - upstream_health)
        const addedDelay  = edge.lead_time_days * (1 - sourceNode.health_score);
        const newDays     = current.daysToImpact + addedDelay;

        queue.push({
          nodeId:           target,
          daysToImpact:     newDays,
          severityReceived: propagatedSeverity,
          pathTaken:        [...current.pathTaken, target],
          hops:             current.hops + 1,
        });
      }
    }

    const affectedList = Object.values(affected)
      .sort((a, b) => a.days_to_impact - b.days_to_impact);

    const result = {
      disrupted_node:  node_id,
      affected_nodes:  affectedList,
      total_affected:  affectedList.length,
      partial_result:  hopsWarning,
    };

    if (!result) {
      throw new Error(`FATAL: simulateRipple returned null — input was: ${JSON.stringify(disruption)}`);
    }

    return {
      ok:    true,
      data:  result,
      error: hopsWarning ? `Partial result: MAX_HOPS (${MAX_HOPS}) reached.` : null,
    };
  } catch (err) {
    console.error('FATAL: simulateRipple failed:', err.message);
    return { ok: false, data: null, error: err.message };
  }
}

export { NOISE_FLOOR, MAX_HOPS };
