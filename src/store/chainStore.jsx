// =============================================================================
// CHAINSIGHT — React State Store (Context + useReducer)
// ASSUMPTIONS:
//   1. All three engine calls (applyDisruption → simulateRipple →
//      generatePrescriptions) run synchronously inside the reducer.
//      For MVP scale (15 nodes), this is safe. Async needed at 1000+ nodes.
//   2. RESET rebuilds state from NODES/EDGES imports — a fresh deep copy,
//      so mutations from a previous disruption cycle are fully cleared.
//   3. useMemo on context value prevents unnecessary child re-renders.
// =============================================================================

import React, {
  createContext, useContext, useReducer, useCallback, useMemo,
} from 'react';
import { NODES, EDGES }             from '../data/graphData';
import { applyDisruption }          from '../engine/disruption';
import { simulateRipple }           from '../engine/ripple';
import { generatePrescriptions }    from '../engine/prescriptions';

// --- ACTIONS -----------------------------------------------------------------
export const ACTION = Object.freeze({
  INJECT_DISRUPTION: 'INJECT_DISRUPTION',
  RESET:             'RESET',
  SET_ERROR:         'SET_ERROR',
});

// --- STATE FACTORY -----------------------------------------------------------
function buildInitialState() {
  return {
    nodes:         NODES.map(n => ({ ...n })),
    edges:         EDGES.map(e => ({ ...e })),
    disruption:    null,
    rippleResult:  null,
    prescriptions: null,
    error:         null,
  };
}

// --- REDUCER -----------------------------------------------------------------
function chainReducer(state, action) {
  try {
    switch (action.type) {

      case ACTION.INJECT_DISRUPTION: {
        const { disruption } = action.payload;
        if (!disruption) {
          return { ...state, error: 'INJECT_DISRUPTION: payload.disruption is null' };
        }

        // ── Step 1: Apply disruption ─────────────────────────────────────────
        const graphResult = applyDisruption(
          { nodes: state.nodes, edges: state.edges },
          disruption
        );
        if (!graphResult.ok) {
          console.error('Disruption engine error:', graphResult.error);
          return { ...state, error: graphResult.error };
        }
        const newGraph = graphResult.data;

        // ── Step 2: Ripple propagation ───────────────────────────────────────
        const rippleResult = simulateRipple(newGraph, disruption);
        if (!rippleResult.ok) {
          console.error('Ripple engine error:', rippleResult.error);
          return { ...state, nodes: newGraph.nodes, edges: newGraph.edges, disruption, error: rippleResult.error };
        }

        // ── Step 3: Prescriptions ────────────────────────────────────────────
        const rxResult = generatePrescriptions(newGraph, rippleResult.data, disruption);
        if (!rxResult.ok) {
          console.error('Prescription engine error:', rxResult.error);
          return {
            ...state,
            nodes: newGraph.nodes, edges: newGraph.edges,
            disruption, rippleResult: rippleResult.data, error: rxResult.error,
          };
        }

        return {
          ...state,
          nodes:         newGraph.nodes,
          edges:         newGraph.edges,
          disruption,
          rippleResult:  rippleResult.data,
          prescriptions: rxResult.data.prescriptions,
          error:         null,
        };
      }

      case ACTION.RESET:
        return buildInitialState();

      case ACTION.SET_ERROR:
        if (action.payload === undefined) {
          throw new Error('FATAL: SET_ERROR returned null — input was: undefined payload');
        }
        return { ...state, error: action.payload };

      default:
        console.warn(`WARN: chainReducer — unknown action type: "${action.type}"`);
        return state;
    }
  } catch (err) {
    console.error('FATAL: chainReducer threw:', err.message);
    return { ...state, error: err.message };
  }
}

// --- CONTEXT -----------------------------------------------------------------
const ChainContext = createContext(null);

export function ChainProvider({ children }) {
  const [state, dispatch] = useReducer(chainReducer, undefined, buildInitialState);

  const injectDisruption = useCallback((disruption) => {
    if (!disruption) {
      console.error('FATAL: injectDisruption returned null — input was: null');
      return;
    }
    dispatch({ type: ACTION.INJECT_DISRUPTION, payload: { disruption } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: ACTION.RESET });
  }, []);

  const value = useMemo(
    () => ({ state, injectDisruption, reset }),
    [state, injectDisruption, reset]
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

// --- HOOK --------------------------------------------------------------------
export function useChain() {
  const ctx = useContext(ChainContext);
  if (!ctx) {
    throw new Error('FATAL: useChain returned null — must be called inside <ChainProvider>');
  }
  return ctx;
}
