// =============================================================================
// CHAINSIGHT — Graph Data Layer
// ASSUMPTIONS:
//   1. Edge direction: source=SUPPLIER, target=CUSTOMER (material flow).
//      edge(A→B) means "A supplies to B". Ripple follows edge direction upward.
//   2. Seed-42 LCG PRNG for deterministic health scores. Range: [0.55, 1.0].
//   3. BN_1 health is clamped to [0.75, 0.88] post-PRNG so it looks like a
//      normal healthy T3 node and does not stand out visually.
//   4. Cycle detection uses Kahn's topological sort. If a cycle is found,
//      the longest edge (by lead_time_days) is removed and a warning is logged.
// =============================================================================

// --- CONSTANTS ---------------------------------------------------------------
const SEED              = 42;
const HEALTH_MIN        = 0.55;
const HEALTH_RANGE      = 0.45;   // health = HEALTH_MIN + rand * HEALTH_RANGE
const BN_HEALTH_MIN     = 0.75;   // Bottleneck clamped range (hidden risk)
const BN_HEALTH_MAX     = 0.88;
const LCG_A             = 1664525;
const LCG_C             = 1013904223;
const LCG_M             = 2 ** 32;

export const TIER        = Object.freeze({ OEM: 'OEM', T1: 'T1', T2: 'T2', T3: 'T3', BN: 'BN' });
export const EVENT_TYPES = Object.freeze(['FIRE', 'FLOOD', 'STRIKE', 'FINANCIAL_DISTRESS', 'PORT_CLOSURE']);

// --- PRNG --------------------------------------------------------------------
function seededRandom(seed) {
  let state = seed >>> 0; // force unsigned 32-bit
  return function next() {
    state = (Math.imul(LCG_A, state) + LCG_C) >>> 0; // unsigned 32-bit overflow
    return state / LCG_M;
  };
}

// --- BUILDERS ----------------------------------------------------------------
function mkNode(id, name, tier, country, is_bottleneck, rand) {
  const raw = rand();
  let health_score = parseFloat((HEALTH_MIN + raw * HEALTH_RANGE).toFixed(3));
  if (is_bottleneck) {
    // Clamp to teal range so bottleneck looks normal
    health_score = parseFloat(
      (BN_HEALTH_MIN + (health_score - HEALTH_MIN) / HEALTH_RANGE * (BN_HEALTH_MAX - BN_HEALTH_MIN)).toFixed(3)
    );
  }
  return { id, name, tier, country, health_score, original_health: health_score, is_bottleneck: !!is_bottleneck };
}

function mkEdge(source, target, lead_time_days, dependency_weight) {
  if (dependency_weight < 0 || dependency_weight > 1)
    throw new RangeError(`mkEdge: dependency_weight ${dependency_weight} out of [0,1] for edge ${source}→${target}`);
  return {
    id: `${source}__${target}`,
    source,
    target,
    lead_time_days,
    dependency_weight: parseFloat(dependency_weight.toFixed(3)),
    frozen: false,
  };
}

// --- CYCLE DETECTION (Kahn's Algorithm) --------------------------------------
function detectAndBreakCycles(nodes, edges) {
  const adj    = {};
  const inDeg  = {};
  nodes.forEach(n => { adj[n.id] = []; inDeg[n.id] = 0; });
  edges.forEach(e => { adj[e.source].push(e.target); inDeg[e.target]++; });

  const queue   = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  let   visited = 0;
  while (queue.length) {
    const cur = queue.shift();
    visited++;
    for (const nb of (adj[cur] || [])) { if (--inDeg[nb] === 0) queue.push(nb); }
  }

  if (visited === nodes.length) return { ok: true, data: null, error: null };

  // Cycle found — break longest edge
  const sorted = [...edges].sort((a, b) => b.lead_time_days - a.lead_time_days);
  const broken = sorted[0];
  const idx    = edges.findIndex(e => e.id === broken.id);
  if (idx !== -1) edges.splice(idx, 1);
  console.warn(`WARN: graphData — cycle detected. Broke edge ${broken.id} (lead_time=${broken.lead_time_days}d)`);
  return { ok: false, data: { brokenEdge: broken.id }, error: 'Cycle detected and broken' };
}

// --- GRAPH BUILDER -----------------------------------------------------------
function buildGraph() {
  try {
    const rand  = seededRandom(SEED);
    const nodes = [];
    const edges = [];
    const n = (id, name, tier, country, isBn = false) => mkNode(id, name, tier, country, isBn, rand);
    const e = (src, tgt, lt, dw) => mkEdge(src, tgt, lt, dw);

    // OEM
    nodes.push(n('OEM_1', 'AlphaCorp OEM',         TIER.OEM, 'USA'));
    // T1
    nodes.push(n('T1_A',  'Nexus Systems',          TIER.T1,  'Germany'));
    nodes.push(n('T1_B',  'ProLink Manufacturing',  TIER.T1,  'Japan'));
    nodes.push(n('T1_C',  'VentureFab',             TIER.T1,  'USA'));
    // T2
    nodes.push(n('T2_A',  'Cascade Components',     TIER.T2,  'China'));
    nodes.push(n('T2_B',  'SteelWave Industries',   TIER.T2,  'Taiwan'));
    nodes.push(n('T2_C',  'Delta Parts Co.',         TIER.T2,  'Mexico'));
    nodes.push(n('T2_D',  'Horizon Substrates',      TIER.T2,  'Vietnam'));
    nodes.push(n('T2_E',  'Orion Precision',         TIER.T2,  'India'));
    nodes.push(n('T2_F',  'Pacific Alloys',          TIER.T2,  'China'));
    // T3
    nodes.push(n('T3_A',  'CoreMin Minerals',        TIER.T3,  'Chile'));
    nodes.push(n('T3_B',  'SempraRaw Materials',     TIER.T3,  'Australia'));
    nodes.push(n('T3_C',  'IronPath Mining',         TIER.T3,  'Brazil'));
    nodes.push(n('T3_D',  'ClearStone Quarry',       TIER.T3,  'Canada'));
    // Bottleneck (hidden — visually identical to T3)
    nodes.push(n('BN_1',  'Apex Critical Supplies',  TIER.BN,  'Taiwan', true));

    // T1 → OEM  (T1 suppliers → OEM customer, material flow)
    edges.push(e('T1_A', 'OEM_1', 7,  0.70));
    edges.push(e('T1_B', 'OEM_1', 10, 0.80));
    edges.push(e('T1_C', 'OEM_1', 5,  0.60));
    // T2 → T1
    edges.push(e('T2_A', 'T1_A', 14, 0.60));
    edges.push(e('T2_B', 'T1_A', 10, 0.75));
    edges.push(e('T2_C', 'T1_B', 12, 0.65));
    edges.push(e('T2_D', 'T1_B', 8,  0.55));
    edges.push(e('T2_E', 'T1_C', 9,  0.70));
    edges.push(e('T2_F', 'T1_C', 11, 0.80));
    // T3 → T2
    edges.push(e('T3_A', 'T2_A', 20, 0.70));
    edges.push(e('T3_B', 'T2_B', 18, 0.65));
    edges.push(e('T3_B', 'T2_C', 15, 0.60));
    edges.push(e('T3_C', 'T2_D', 22, 0.75));
    edges.push(e('T3_D', 'T2_E', 17, 0.70));
    edges.push(e('T3_D', 'T2_F', 19, 0.80));
    // BN → T3  (hidden shared dependency — ALL T3 depend on bottleneck)
    edges.push(e('BN_1', 'T3_A', 25, 0.85));
    edges.push(e('BN_1', 'T3_B', 22, 0.90));
    edges.push(e('BN_1', 'T3_C', 28, 0.80));
    edges.push(e('BN_1', 'T3_D', 24, 0.88));

    // Validate counts
    if (nodes.length !== 15)
      throw new Error(`FATAL: buildGraph returned null — expected 15 nodes, got ${nodes.length}`);
    if (edges.length < 19)
      throw new Error(`FATAL: buildGraph returned null — expected ≥19 edges, got ${edges.length}`);

    // Cycle detection
    detectAndBreakCycles(nodes, edges);

    return { ok: true, data: { nodes, edges }, error: null };
  } catch (err) {
    console.error('FATAL: buildGraph failed:', err.message);
    return { ok: false, data: null, error: err.message };
  }
}

// --- INITIALISE & EXPORT -----------------------------------------------------
const GRAPH_RESULT = buildGraph();
if (!GRAPH_RESULT.ok) {
  throw new Error('FATAL: graphData module failed to initialise: ' + GRAPH_RESULT.error);
}

export const NODES          = GRAPH_RESULT.data.nodes;
export const EDGES          = GRAPH_RESULT.data.edges;
export const GRAPH_META     = Object.freeze({ seed: SEED, node_count: NODES.length, edge_count: EDGES.length });
export default GRAPH_RESULT;
