// =============================================================================
// CHAINSIGHT — Root Application Component
// ASSUMPTIONS:
//   1. Layout: full-height flex column (header + main). Main splits into
//      graph panel (flex-grow) and fixed-width side panel (320px).
//   2. ChainProvider wraps everything so both GraphCanvas and ControlPanel
//      share the same store instance.
//   3. Header is purely informational — no interactive state.
// =============================================================================

import React from 'react';
import { ChainProvider } from './store/chainStore';
import GraphCanvas       from './components/GraphCanvas';
import ControlPanel      from './components/ControlPanel';

// --- CONSTANTS ---------------------------------------------------------------
const APP_NAME    = 'ChainSight';
const APP_VERSION = '0.1.0 MVP';
const GRAPH_META  = '15 nodes · seed-42 · synthetic';
const PANEL_W     = 320;

// --- COMPONENT ---------------------------------------------------------------
export default function App() {
  return (
    <ChainProvider>
      <div className="flex flex-col h-screen bg-cs-bg text-cs-text overflow-hidden select-none">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 border-b border-cs-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cs-teal/30 to-cs-purple/20
                            border border-cs-teal/40 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8"  cy="2.5" r="1.8" fill="#1D9E75" />
                <circle cx="3"  cy="9"   r="1.8" fill="#1D9E75" />
                <circle cx="13" cy="9"   r="1.8" fill="#BA7517" />
                <circle cx="8"  cy="14"  r="1.8" fill="#534AB7" />
                <line x1="8"  y1="4.3"  x2="3"  y2="7.2"  stroke="#1E3A5F" strokeWidth="1.2" />
                <line x1="8"  y1="4.3"  x2="13" y2="7.2"  stroke="#1E3A5F" strokeWidth="1.2" />
                <line x1="3"  y1="10.8" x2="8"  y2="12.2" stroke="#1E3A5F" strokeWidth="1.2" />
                <line x1="13" y1="10.8" x2="8"  y2="12.2" stroke="#1E3A5F" strokeWidth="1.2" />
              </svg>
            </div>

            <div>
              <h1 className="text-sm font-bold text-cs-text tracking-tight leading-none">
                {APP_NAME}
              </h1>
              <p className="text-[10px] text-cs-muted leading-none mt-0.5">
                Supply Chain Visibility — {APP_VERSION}
              </p>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 text-[10px] text-cs-muted font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cs-teal animate-pulse" />
              LIVE
            </span>
            <span className="text-cs-border">|</span>
            <span>{GRAPH_META}</span>
            <span className="text-cs-border">|</span>
            <span className="hidden sm:inline">OEM → T1 → T2 → T3 → BN</span>
          </div>
        </header>

        {/* ── Main layout ────────────────────────────────────────────────── */}
        <main className="flex flex-1 overflow-hidden">

          {/* D3 graph canvas — takes all remaining width */}
          <div className="flex-1 relative overflow-hidden border-r border-cs-border">
            <GraphCanvas />
          </div>

          {/* Control + output panel — fixed width */}
          <aside
            className="flex-shrink-0 overflow-y-auto bg-cs-surface p-3"
            style={{ width: `${PANEL_W}px` }}
          >
            <ControlPanel />
          </aside>
        </main>

      </div>
    </ChainProvider>
  );
}
