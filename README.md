# ChainSight — Supply Chain Visibility Platform

> Real-time supply chain disruption visibility: ripple propagation, bottleneck detection, and mitigation prescriptions.

![Version](https://img.shields.io/badge/version-0.1.0--MVP-blue)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![D3](https://img.shields.io/badge/D3.js-7.9.0-F9A03C?logo=d3dotjs)
![Vite](https://img.shields.io/badge/Vite-5.4.1-646CFF?logo=vite)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Graph Data Model](#graph-data-model)
- [Engine Modules](#engine-modules)
  - [Disruption Engine](#1-disruption-engine)
  - [Ripple Propagation Engine](#2-ripple-propagation-engine)
  - [Prescription Generator](#3-prescription-generator)
- [State Management](#state-management)
- [UI Components](#ui-components)
- [Simulation & Visualization](#simulation--visualization)
- [Configuration & Constants](#configuration--constants)
- [Design System](#design-system)
- [Known Limitations & Future Work](#known-limitations--future-work)

---

## Overview

**ChainSight** is an interactive supply chain risk visualization tool built as a single-page React application. It models a synthetic multi-tier supply chain network (OEM → T1 → T2 → T3 → Bottleneck) and lets you inject disruption events (fires, floods, port closures, etc.) to observe how risk propagates upstream toward the end manufacturer — and what mitigations are recommended.

The application is designed around three core ideas:

1. **Visibility** — render the entire supply chain as a force-directed graph so structure and dependencies are immediately clear.
2. **Simulation** — propagate disruptions through the graph using a BFS-based ripple algorithm that accounts for dependency weights and lead times.
3. **Prescription** — automatically generate ranked mitigation actions (alternate supplier activation, inventory buffering) scored on severity impact, speed, and cost.

---

## Features

| Feature | Description |
|---|---|
| **Interactive Graph Canvas** | D3.js force-directed graph with tier-based Y-axis positioning and animated disruption cascades |
| **Disruption Injection** | Choose any of 15 nodes, set event type, severity (0–100%), and start day |
| **Ripple Propagation** | BFS engine traces affected nodes with cumulative delay (in days) and received severity |
| **Bottleneck Detection** | A hidden `BN_1` node (Apex Critical Supplies) feeds ALL T3 nodes — exposing a shared single point of failure |
| **Mitigation Prescriptions** | Two ranked prescriptions always generated: alternate supplier + inventory buffer |
| **Visual Health Indicators** | Node colors shift teal → amber → red based on health score; frozen edges turn red |
| **Reset & Re-run** | Full state reset rebuilds from original deterministic graph (seed-42) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        App.jsx                           │
│   ChainProvider wraps the full layout                    │
│   ┌─────────────────────┐  ┌───────────────────────────┐ │
│   │    GraphCanvas.jsx  │  │    ControlPanel.jsx       │ │
│   │  (D3 SVG canvas)    │  │  (form + results panel)   │ │
│   └──────────┬──────────┘  └────────────┬──────────────┘ │
│              │                          │                 │
│              └──────────┬───────────────┘                 │
│                         │                                 │
│              ┌──────────▼──────────┐                      │
│              │   chainStore.jsx    │                      │
│              │  (Context/Reducer)  │                      │
│              └──────────┬──────────┘                      │
│                         │                                 │
│          ┌──────────────┼──────────────┐                  │
│          ▼              ▼              ▼                  │
│   disruption.js     ripple.js   prescriptions.js         │
│   (Engine Layer)                                          │
│                                                           │
│              ┌──────────────────────┐                     │
│              │    graphData.js      │                     │
│              │  (Static Data Layer) │                     │
│              └──────────────────────┘                     │
└──────────────────────────────────────────────────────────┘
```

Data flows in one direction: form input → `injectDisruption` → reducer → engine pipeline → updated state → re-render.

---

## Project Structure

```
Chainsight-main/
├── index.html                    # Entry HTML, Tailwind CDN, custom color tokens
├── package.json                  # Dependencies: react, react-dom, d3, vite
├── vite.config.js                # Vite + React plugin config
├── runcmd.txt                    # Quick-start hint: npm run dev
└── src/
    ├── main.jsx                  # React DOM entry point
    ├── App.jsx                   # Root layout: header + graph canvas + sidebar
    ├── index.css                 # Global CSS resets and base styles
    ├── store/
    │   └── chainStore.jsx        # Context, useReducer, actions, ChainProvider
    ├── components/
    │   ├── GraphCanvas.jsx       # D3 SVG rendering + disruption animations
    │   └── ControlPanel.jsx      # Disruption form + ripple results + prescriptions
    ├── engine/
    │   ├── disruption.js         # Applies a disruption event to graph state
    │   ├── ripple.js             # BFS ripple propagation algorithm
    │   └── prescriptions.js     # Generates & scores mitigation prescriptions
    ├── data/
    │   └── graphData.js          # Deterministic 15-node/23-edge graph (seed-42)
    └── hooks/
        └── useGraphSimulation.js # D3 force simulation logic (extracted hook)
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Clone or unzip the project
cd Chainsight-main

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` by default.

### Build for Production

```bash
npm run build
npm run preview   # Preview the built output locally
```

---

## Graph Data Model

The synthetic supply chain is defined in `src/data/graphData.js` and contains **15 nodes** and **23 directed edges**. It is deterministic — health scores are generated using a seeded Linear Congruential Generator (seed = 42) so the graph is identical on every run.

### Supply Chain Tiers

| Tier | ID | Name | Country |
|------|----|------|---------|
| OEM | `OEM_1` | AlphaCorp OEM | USA |
| T1 | `T1_A` | Nexus Systems | Germany |
| T1 | `T1_B` | ProLink Manufacturing | Japan |
| T1 | `T1_C` | VentureFab | USA |
| T2 | `T2_A` | Cascade Components | China |
| T2 | `T2_B` | SteelWave Industries | Taiwan |
| T2 | `T2_C` | Delta Parts Co. | Mexico |
| T2 | `T2_D` | Horizon Substrates | Vietnam |
| T2 | `T2_E` | Orion Precision | India |
| T2 | `T2_F` | Pacific Alloys | China |
| T3 | `T3_A` | CoreMin Minerals | Chile |
| T3 | `T3_B` | SempraRaw Materials | Australia |
| T3 | `T3_C` | IronPath Mining | Brazil |
| T3 | `T3_D` | ClearStone Quarry | Canada |
| **BN** | **`BN_1`** | **Apex Critical Supplies** | **Taiwan** |

> **Note:** `BN_1` is the hidden bottleneck node. It is visually rendered identically to T3 nodes (health clamped to [0.75, 0.88] to appear normal), but supplies ALL four T3 nodes with high dependency weights (0.80–0.90). Disrupting it cascades across the entire supply chain.

### Edge Model

Each edge represents a supply relationship and carries:

| Property | Type | Description |
|---|---|---|
| `id` | string | `"source__target"` format |
| `source` | string | Supplier node ID (material origin) |
| `target` | string | Customer node ID (material destination) |
| `lead_time_days` | number | Days to deliver material through this link |
| `dependency_weight` | float [0–1] | How much the customer depends on this supplier |
| `frozen` | boolean | Set `true` when source is disrupted (supply severed) |

Edge direction follows material flow: `T3 → T2 → T1 → OEM`. Ripple propagation follows this direction (upstream toward OEM).

---

## Engine Modules

### 1. Disruption Engine

**File:** `src/engine/disruption.js`

**Function:** `applyDisruption(graphState, disruption) → Result`

Applies a disruption event to a specific node and returns a new (immutable) graph state.

#### Supported Event Types

| Event | Description |
|-------|-------------|
| `FIRE` | Factory fire |
| `FLOOD` | Natural flood event |
| `STRIKE` | Labor strike |
| `FINANCIAL_DISTRESS` | Supplier financial instability |
| `PORT_CLOSURE` | Logistics/port disruption |

#### Disruption Object Schema

```js
{
  node_id: "T2_A",          // Target node (string, required)
  event_type: "FIRE",       // One of VALID_EVENT_TYPES
  severity: 0.75,           // Float [0.0 – 1.0]
  start_day: 1              // Non-negative integer (day of disruption)
}
```

#### What It Does

- Sets `disrupted: true`, `disruption_event`, `disruption_severity`, and `disruption_start_day` on the targeted node
- Recalculates `health_score` as `1 - severity` (clamped to [0, 1])
- Sets `frozen: true` on all **outbound** edges from the disrupted node
- Returns a new `{ nodes, edges }` state — original is never mutated

---

### 2. Ripple Propagation Engine

**File:** `src/engine/ripple.js`

**Function:** `simulateRipple(graphState, disruption) → Result`

Performs a **BFS traversal** of the graph starting from the disrupted node to determine which upstream nodes are affected, by how much, and how quickly.

#### Algorithm

1. Build a forward adjacency map (`source → [{ target, edge }]`)
2. Start BFS at `disruption.node_id` with `severityReceived = disruption.severity` and `daysToImpact = 0`
3. At each hop:
   - `propagatedSeverity = currentSeverity × edge.dependency_weight`
   - Stop if `propagatedSeverity < 0.05` (noise floor)
   - `addedDelay = edge.lead_time_days × (1 - sourceNode.health_score)`
4. If a node is reachable via multiple paths, keep the **worst-case** (highest severity) result
5. Guard against infinite loops with `MAX_HOPS = 20`

#### Output

```js
{
  disrupted_node: "BN_1",
  affected_nodes: [
    {
      node_id: "T3_A",
      days_to_impact: 6.25,
      severity_received: 0.638,
      path_taken: ["BN_1", "T3_A"]
    },
    // ...sorted by days_to_impact ascending
  ],
  total_affected: 14,
  partial_result: false   // true if MAX_HOPS was hit
}
```

---

### 3. Prescription Generator

**File:** `src/engine/prescriptions.js`

**Function:** `generatePrescriptions(graphState, rippleData, disruption) → Result`

Always generates **exactly 2 ranked mitigation prescriptions**.

#### Prescription 1: `ALT_SUPPLIER`

- Scans all T3 and BN nodes
- Selects the highest `health_score` node **not** in the disrupted path
- Falls back to the least-impacted T3/BN node if all are affected

#### Prescription 2: `INVENTORY_BUFFER`

- Calculates `bufferDays = ceil(maxDaysToImpact × 0.60)`
- Covers 60% of the worst-case lead time
- Falls back to 30 days if no nodes are affected

#### Scoring Formula

```
score = severity_blocked × 0.50
      + speed_of_action  × 0.30
      + cost_efficiency  × 0.20
```

| Metric | ALT_SUPPLIER | INVENTORY_BUFFER |
|--------|-------------|-----------------|
| `speed_of_action` | 0.40 (slower — qualification needed) | 0.80 (fast — just stock up) |
| `cost_efficiency` | 0.50 (medium) | 0.30 (ties up working capital) |
| `severity_blocked` | `disruption.severity × altNode.health_score` | `disruption.severity × 0.70` |

Prescriptions are ranked descending by score. Tie-break: `speed_of_action DESC` → `node_id/type ASC` (alphabetical).

---

## State Management

**File:** `src/store/chainStore.jsx`

Uses React `Context` + `useReducer`. No external state library is required.

### State Shape

```js
{
  nodes:         Node[],           // Current graph nodes (post-disruption)
  edges:         Edge[],           // Current graph edges (with frozen flags)
  disruption:    Disruption|null,  // Last injected disruption
  rippleResult:  RippleResult|null,
  prescriptions: Prescription[]|null,
  error:         string|null
}
```

### Actions

| Action | Payload | Effect |
|--------|---------|--------|
| `INJECT_DISRUPTION` | `{ disruption }` | Runs full engine pipeline: disrupt → ripple → prescriptions |
| `RESET` | — | Rebuilds state from original NODES/EDGES (deep copy) |
| `SET_ERROR` | `errorMessage` | Sets error state |

### Engine Pipeline (inside reducer)

```
applyDisruption()  →  simulateRipple()  →  generatePrescriptions()
```

All three run **synchronously** — safe for MVP scale (15 nodes). Async processing would be needed at 1,000+ nodes.

### Hooks

```js
// Access state and actions anywhere inside <ChainProvider>
const { state, injectDisruption, reset } = useChain();
```

---

## UI Components

### `App.jsx`

Root component. Renders:
- Fixed-height header with app name, version, graph metadata, and live status indicator
- Full-height main layout split into:
  - **GraphCanvas** (flex-grow, left side)
  - **ControlPanel** (fixed 360px width, right side)

### `ControlPanel.jsx`

Right sidebar with three sections:

1. **Disruption Form** — node picker (dropdown), event type picker, severity slider (0–100%), start day input, and a Trigger/Reset button
2. **Ripple Results** — shows `total_affected` count and a list of affected nodes with delay and severity received
3. **Prescriptions** — two ranked prescription cards with score, description, and metric chips (`severity_blocked`, `speed_of_action`, `cost_efficiency`)

> The Trigger button is **disabled** while a disruption is active — the user must Reset first.

### `GraphCanvas.jsx`

SVG canvas powered by D3. Renders:
- Tier labels (OEM / T1 / T2 / T3 on the left axis)
- Directed edges with arrowheads; frozen edges turn red
- Nodes colored by health (teal = healthy, amber = degraded, red = critical, purple = bottleneck under active disruption)
- Staggered cascade animation on disruption (260ms stagger, 650ms transition)
- HTML fallback table if D3 import fails

---

## Simulation & Visualization

**File:** `src/hooks/useGraphSimulation.js`

D3 force simulation configuration:

| Force | Setting | Purpose |
|-------|---------|---------|
| `charge` | strength = -500 | Node repulsion |
| `link` | distance = 115 | Edge target length |
| `tier Y` | strength = 0.88 | Pins nodes to their tier row |
| `center X` | strength = 0.04 | Weak horizontal centering |
| `collision` | radius = 38 | Prevents node overlap |

Node layout uses fixed Y-axis tiers:

```js
{ OEM: 72, T1: 195, T2: 335, T3: 475, BN: 475 }
```

`BN_1` is placed at the same Y-level as T3 nodes to visually disguise it as a regular T3 supplier.

**Color scheme:**

| Color | Meaning |
|-------|---------|
| Teal `#1D9E75` | `health_score > 0.70` — healthy |
| Amber `#BA7517` | `health_score ∈ [0.40, 0.70]` — degraded |
| Red `#E24B4A` | `health_score < 0.40` — critical |
| Purple `#534AB7` | Bottleneck node under active disruption |

---

## Configuration & Constants

Key tunable constants across the codebase:

| Constant | Location | Value | Description |
|---|---|---|---|
| `SEED` | `graphData.js` | `42` | PRNG seed for deterministic health scores |
| `HEALTH_MIN` | `graphData.js` | `0.55` | Minimum base health score |
| `NOISE_FLOOR` | `ripple.js` | `0.05` | Minimum severity to continue ripple propagation |
| `MAX_HOPS` | `ripple.js` | `20` | Anti-infinite-loop guard |
| `BUFFER_FACTOR` | `prescriptions.js` | `0.60` | Buffer days = max_impact_days × 0.60 |
| `FALLBACK_BUFFER_DAYS` | `prescriptions.js` | `30` | Default buffer when no nodes are affected |
| `CHARGE_STRENGTH` | `useGraphSimulation.js` | `-500` | D3 node repulsion force |
| `LINK_DISTANCE` | `useGraphSimulation.js` | `115` | D3 edge target length |
| `CASCADE_STAGGER_MS` | `useGraphSimulation.js` | `260` | Animation stagger delay per hop |

---

## Design System

ChainSight uses a custom dark theme implemented via Tailwind CSS custom tokens defined in `index.html`:

| Token | Hex | Usage |
|---|---|---|
| `cs-bg` | `#0D1117` | Page background |
| `cs-surface` | `#161B22` | Card / panel background |
| `cs-border` | `#30363D` | Border color |
| `cs-muted` | `#8B949E` | Subtle text / labels |
| `cs-text` | `#C9D1D9` | Primary text |
| `cs-teal` | `#1D9E75` | Healthy state / brand accent |
| `cs-amber` | `#BA7517` | Warning / degraded state |
| `cs-red` | `#E24B4A` | Critical / error state |
| `cs-blue` | `#3B82F6` | Logo accent / info |

**Fonts:**
- `DM Sans` — UI text (400, 500, 600, 700)
- `JetBrains Mono` — metrics, IDs, status bar (400, 600)

---

## Known Limitations & Future Work

| Area | Current MVP | Future Improvement |
|---|---|---|
| **Scale** | 15 nodes, synchronous engine | Async/worker-based engine for 1,000+ nodes |
| **Disruptions** | Single active disruption at a time | Simultaneous multi-node disruptions |
| **Graph data** | Hardcoded synthetic data | Import from CSV/JSON or live API |
| **Prescriptions** | 2 fixed types (ALT_SUPPLIER, INVENTORY_BUFFER) | Dynamic prescription catalog, LLM-assisted recommendations |
| **Time simulation** | Static start day input | Animated day-by-day timeline playback |
| **Persistence** | No save/load | Export disruption scenarios and results |
| **Auth/Multi-user** | None | Collaborative scenario sharing |
| **Tailwind** | CDN (dev only) | Compile-time Tailwind for production |

---

## License

Private — see repository for licensing terms.
