/**
 * Serialize / deserialize meta-progression state.
 * Run state is NOT saved (permadeath — no mid-run saves).
 */
export class SaveSystem {
  static STORAGE_KEY = 'cookielike_meta';

  /**
   * Serialize meta state to a JSON string.
   * @param {object} meta
   * @returns {string}
   */
  static serialize(meta) {
    return JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      meta,
    });
  }

  /**
   * Deserialize a JSON string back to meta state.
   * @param {string} json
   * @returns {object|null} meta state, or null on failure
   */
  static deserialize(json) {
    try {
      const data = JSON.parse(json);
      if (!data || data.version !== 1 || !data.meta) return null;
      return data.meta;
    } catch {
      return null;
    }
  }

  /**
   * Export full save (meta + optional run snapshot) for debugging.
   * @param {object} gameState
   * @returns {string}
   */
  static exportFull(gameState) {
    return JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      phase: gameState.phase,
      seed: gameState.seed,
      meta: gameState.meta,
      run: gameState.run,
    }, null, 2);
  }

  /**
   * Import full save for debugging / replay.
   * @param {string} json
   * @returns {object|null}
   */
  static importFull(json) {
    try {
      const data = JSON.parse(json);
      if (!data || data.version !== 1) return null;
      return data;
    } catch {
      return null;
    }
  }
}
