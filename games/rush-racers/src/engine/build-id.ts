/**
 * The simulation build id `vite.config.ts` defines as `__BUILD_ID__`: a hash of the code every peer
 * in an online race must share. A page sends it when it joins a room, and the room refuses a page
 * whose build differs from the others'.
 */

declare global {
  /** Replaced at build time by Vite's `define`; see `simulationBuildId` in `vite.config.ts`. */
  const __BUILD_ID__: string;
}

/** This page's simulation build id. */
export const BUILD_ID: string = __BUILD_ID__;
