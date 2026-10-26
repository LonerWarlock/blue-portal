'use strict';

// One exact allowlist shared by runtime validation and catalogue discovery.
// Legacy clients keep their explicitly requested paid reviewer; never fall back.
module.exports = Object.freeze({
  free: 'dots-studio/dots-3-note-preview:free',
  retiredFree: Object.freeze(['qwen/qwen3.8-27b:free']),
  legacy: 'openai/gpt-5.4-mini'
});
