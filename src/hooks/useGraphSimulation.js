// =============================================================================
// CHAINSIGHT — D3 Force Simulation Logic (extracted from GraphCanvas)
// ASSUMPTIONS:
//   1. Edge direction: source=SUPPLIER, target=CUSTOMER. Arrows point upstream.
//      BN_1 is at the BOTTOM of the layout (same tier-y as T3 — hidden visually).
//   2. D3 mutates simNode objects (adds x,y,vx,vy). We work on deep copies so
//      React state is never mutated by D3.
//   3. nodeById is a mutable lookup. updateGraph writes .health_score into it
//      so the simulation reflects post-disruption health for color rendering.
//   4. On library import failure (error rule #1): D3 is a required approved
//      library. If d3 import fails at module load, GraphCanvas catches the
//      thrown error and switches to the HTML fallback table.
// =============================================================================

import * as d3 from 'd3';

// --- CONSTANTS ---------------------------------------------------------------
const CHARGE_STRENGTH    = -500;
const LINK_DISTANCE      = 115;
const TIER_FORCE_STR     = 0.88;
const CENTER_X_STR       = 0.04;
const COLLISION_RADIUS   = 38;
const NODE_RADIUS        = 22;
const NODE_STROKE_W      = 2.5;
const EDGE_BASE_W        = 4;
const EDGE_OPACITY       = 0.65;
const HEALTH_HIGH        = 0.70;
const HEALTH_LOW         = 0.40;
const CASCADE_STAGGER_MS = 260;
const TRANSITION_MS      = 650;
const ARROW_SIZE         = 6;

const TIER_Y = Object.freeze({ OEM: 72, T1: 195, T2: 335, T3: 475, BN: 475 });

const COL = Object.freeze({
  TEAL:    '#1D9E75',
  AMBER:   '#BA7517',
  RED:     '#E24B4A',
  PURPLE:  '#534AB7',
  EDGE:    '#1E3A5F',
  EDGE_FROZEN: '#E24B4A',
  STROKE:  '#0A0F1E',
  TEXT:    '#94A3B8',
});

// --- HELPERS -----------------------------------------------------------------
export function nodeColor(node, disruptionActive) {
  if (!node) throw new Error(`FATAL: nodeColor returned null — input was: ${JSON.stringify(node)}`);
  if (node.is_bottleneck && disruptionActive) return COL.PURPLE;
  if (node.health_score > HEALTH_HIGH)        return COL.TEAL;
  if (node.health_score >= HEALTH_LOW)        return COL.AMBER;
  return COL.RED;
}

function edgeStrokeWidth(e) {
  return Math.max(1, e.dependency_weight * EDGE_BASE_W);
}

function truncate(str, max) {
  return str && str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// --- INIT SIMULATION ---------------------------------------------------------
/**
 * Bootstrap the D3 force graph into an SVG element.
 * Returns refs object { simulation, nodeG, edgeG, nodeById }.
 */
export function initSimulation(svgEl, nodes, edges, width, height) {
  if (!svgEl) throw new Error('FATAL: initSimulation returned null — input was: null svgEl');
  if (!nodes || !edges) throw new Error('FATAL: initSimulation returned null — input was: null nodes/edges');

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  // Arrow marker
  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'cs-arrow').attr('viewBox', '0 -4 8 8')
    .attr('refX', NODE_RADIUS + 6).attr('refY', 0)
    .attr('markerWidth', ARROW_SIZE).attr('markerHeight', ARROW_SIZE)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', COL.EDGE);

  defs.append('marker')
    .attr('id', 'cs-arrow-red').attr('viewBox', '0 -4 8 8')
    .attr('refX', NODE_RADIUS + 6).attr('refY', 0)
    .attr('markerWidth', ARROW_SIZE).attr('markerHeight', ARROW_SIZE)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', COL.RED);

  // Zoom layer
  const g = svg.append('g').attr('class', 'cs-root');
  svg.call(d3.zoom().scaleExtent([0.35, 2.8])
    .on('zoom', ev => g.attr('transform', ev.transform)));

  // Build sim copies — D3 mutates these
  const tierCount = {};
  nodes.forEach(n => { tierCount[n.tier] = (tierCount[n.tier] || 0) + 1; });
  const tierIdx = {};
  const simNodes = nodes.map(n => {
    tierIdx[n.tier] = (tierIdx[n.tier] || 0) + 1;
    const slot  = tierIdx[n.tier];
    const total = tierCount[n.tier];
    return { ...n, x: (slot / (total + 1)) * width, y: TIER_Y[n.tier] ?? (height / 2) };
  });

  const nodeById = Object.fromEntries(simNodes.map(n => [n.id, n]));

  const simEdges = edges.map(e => ({
    ...e,
    source: nodeById[e.source] ?? e.source,
    target: nodeById[e.target] ?? e.target,
  }));

  // ── Edge layer ─────────────────────────────────────────────────────────────
  const edgeG = g.append('g').attr('class', 'cs-edges')
    .selectAll('line')
    .data(simEdges, d => d.id)
    .join('line')
    .attr('stroke', COL.EDGE)
    .attr('stroke-width', edgeStrokeWidth)
    .attr('stroke-opacity', EDGE_OPACITY)
    .attr('marker-end', 'url(#cs-arrow)')
    .attr('data-edge-id', d => d.id);

  // ── Node layer ─────────────────────────────────────────────────────────────
  const nodeG = g.append('g').attr('class', 'cs-nodes')
    .selectAll('g.cs-node')
    .data(simNodes, d => d.id)
    .join('g')
    .attr('class', 'cs-node')
    .attr('data-node-id', d => d.id)
    .attr('cursor', 'default');

  // Pulse ring placeholder (hidden until bottleneck revealed)
  nodeG.append('circle').attr('class', 'bn-ring').attr('r', NODE_RADIUS).attr('visibility', 'hidden');

  // Main circle
  nodeG.append('circle')
    .attr('class', 'cs-circle')
    .attr('r', NODE_RADIUS)
    .attr('fill', d => nodeColor(d, false))
    .attr('stroke', COL.STROKE)
    .attr('stroke-width', NODE_STROKE_W);

  // Tier label (inside circle) — BN shows as T3
  nodeG.append('text')
    .attr('text-anchor', 'middle').attr('dy', '0.36em')
    .attr('font-size', '9px').attr('font-weight', '700')
    .attr('fill', 'rgba(255,255,255,0.9)').attr('pointer-events', 'none')
    .text(d => d.tier === 'BN' ? 'T3' : d.tier);

  // Node name (below circle)
  nodeG.append('text')
    .attr('text-anchor', 'middle').attr('dy', NODE_RADIUS + 15)
    .attr('font-size', '8.5px').attr('fill', COL.TEXT).attr('pointer-events', 'none')
    .text(d => truncate(d.name, 15));

  // Days-to-impact badge (hidden until cascade)
  const badgeG = nodeG.append('g').attr('class', 'cs-badge').attr('visibility', 'hidden');
  badgeG.append('rect')
    .attr('x', -17).attr('y', -NODE_RADIUS - 19)
    .attr('width', 34).attr('height', 14)
    .attr('rx', 4).attr('fill', COL.RED);
  badgeG.append('text')
    .attr('class', 'cs-badge-text')
    .attr('text-anchor', 'middle').attr('dy', -NODE_RADIUS - 9)
    .attr('font-size', '7.5px').attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('fill', 'white').attr('pointer-events', 'none');

  // ── Force simulation ───────────────────────────────────────────────────────
  const simulation = d3.forceSimulation(simNodes)
    .force('link',      d3.forceLink(simEdges).id(d => d.id).distance(LINK_DISTANCE))
    .force('charge',    d3.forceManyBody().strength(CHARGE_STRENGTH))
    .force('x',         d3.forceX(width / 2).strength(CENTER_X_STR))
    .force('y',         d3.forceY(d => TIER_Y[d.tier] ?? height / 2).strength(TIER_FORCE_STR))
    .force('collision', d3.forceCollide(COLLISION_RADIUS));

  simulation.on('tick', () => {
    edgeG
      .attr('x1', d => d.source.x ?? 0).attr('y1', d => d.source.y ?? 0)
      .attr('x2', d => d.target.x ?? 0).attr('y2', d => d.target.y ?? 0);
    nodeG.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  });

  return { simulation, g, nodeG, edgeG, nodeById };
}

// --- UPDATE GRAPH (post-disruption) ------------------------------------------
export function updateGraph(refs, nodes, edges, disruption, rippleResult) {
  if (!refs) { console.warn('WARN: updateGraph called with null refs'); return; }
  const { nodeG, edgeG, nodeById } = refs;

  // Sync health from latest state into sim node lookup
  nodes.forEach(n => { if (nodeById[n.id]) nodeById[n.id].health_score = n.health_score; });

  const frozenIds = new Set(edges.filter(e => e.frozen).map(e => e.id));
  const affected  = rippleResult?.affected_nodes ?? [];
  const affSorted = [...affected].sort((a, b) => a.days_to_impact - b.days_to_impact);

  // Update node fills — use datum accessor d directly (D3 v7: .classed() illegal on transition)
  nodeG.selectAll('.cs-circle')
    .transition().duration(TRANSITION_MS)
    .attr('fill', d => nodeColor(nodeById[d.id] ?? d, !!disruption));

  // Bottleneck: reveal pulse ring
  if (disruption) {
    nodeG.filter(d => d.id === disruption.node_id && nodeById[d.id]?.is_bottleneck)
      .select('.bn-ring')
      .attr('r', NODE_RADIUS + 9)
      .attr('visibility', 'visible')
      .attr('class', 'bn-ring node-bn-ring');
  }

  // Frozen edges: red + severed animation (.classed on selection, not transition — D3 v7)
  edgeG
    .attr('stroke',     d => frozenIds.has(d.id) ? COL.EDGE_FROZEN : COL.EDGE)
    .attr('marker-end', d => frozenIds.has(d.id) ? 'url(#cs-arrow-red)' : 'url(#cs-arrow)');
  edgeG.classed('edge-severed', d => frozenIds.has(d.id));

  // Cascade — setTimeout stagger avoids D3 transition .classed() incompatibility
  affSorted.forEach((item, i) => {
    setTimeout(() => {
      if (!refs.nodeG) return; // guard: component may have unmounted
      refs.nodeG.filter(d => d.id === item.node_id)
        .select('.cs-circle').classed('node-cascade-flash', true);
      refs.nodeG.filter(d => d.id === item.node_id)
        .select('.cs-badge')
        .attr('visibility', 'visible')
        .attr('class', 'cs-badge badge-group');
      refs.nodeG.filter(d => d.id === item.node_id)
        .select('.cs-badge-text')
        .text(`${item.days_to_impact}d`);
    }, i * CASCADE_STAGGER_MS);
  });
}

// --- RESET GRAPH -------------------------------------------------------------
export function resetGraph(refs, nodes) {
  if (!refs) { console.warn('WARN: resetGraph called with null refs'); return; }
  const { nodeG, edgeG, nodeById } = refs;

  // Restore health scores
  nodes.forEach(n => { if (nodeById[n.id]) nodeById[n.id].health_score = n.original_health ?? n.health_score; });

  // Remove classes on SELECTION first — .classed() is illegal on transitions (D3 v7)
  nodeG.selectAll('.cs-circle').classed('node-cascade-flash', false);

  // Animate fill back to original health color
  nodeG.selectAll('.cs-circle')
    .transition().duration(TRANSITION_MS)
    .attr('fill', d => nodeColor(nodeById[d.id] ?? d, false))
    .attr('stroke', COL.STROKE)
    .attr('stroke-width', NODE_STROKE_W);

  // Hide pulse ring and badges
  nodeG.selectAll('.bn-ring').attr('r', NODE_RADIUS).attr('visibility', 'hidden').attr('class', 'bn-ring');
  nodeG.selectAll('.cs-badge').attr('visibility', 'hidden').attr('class', 'cs-badge');

  // Reset edges
  edgeG.attr('stroke', COL.EDGE).attr('marker-end', 'url(#cs-arrow)');
  edgeG.classed('edge-severed', false).classed('edge-cascade', false);
}
