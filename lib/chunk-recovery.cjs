'use strict';

// Keep a failed parser-inserted script from being mistaken for an in-flight
// script when Webpack subsequently tries to load the same chunk. Do not stop
// the event: any loader handler already attached must still receive it.
const FAILED_INITIAL_CHUNK_CLEANUP = `
document.addEventListener('error', function (event) {
  var script = event.target;
  if (!script || script.tagName !== 'SCRIPT' || !script.src) return;
  try {
    var url = new URL(script.src, document.baseURI);
    if (url.origin === location.origin && /^\\/_next\\/static\\/chunks\\/.+\\.js$/.test(url.pathname)
      && script.parentNode) script.parentNode.removeChild(script);
  } catch (_) {}
}, true);
`;

// This function is serialized into the *client* Webpack runtime. It wraps the
// script transport, not RSC's chunk-ID/filename map or application execution.
// A failed transport remains pending for at most two bounded retries. A real
// JS exception, a missing registration, and exhausted retries still propagate.
function installChunkRecovery(runtime) {
  var load = runtime.l;
  runtime.l = function (url, done, key, chunkId) {
    var eligible = false;
    try {
      var parsed = new URL(url, document.baseURI);
      eligible = parsed.origin === location.origin && /^\/_next\/static\/chunks\/.+\.js$/.test(parsed.pathname);
    } catch (_) {}
    if (!eligible) return load(url, done, key, chunkId);
    function attempt(number) {
      var target = url;
      if (number) {
        var retryUrl = new URL(url, document.baseURI);
        retryUrl.searchParams.set('blue_chunk_retry', String(number));
        target = retryUrl.href;
      }
      return load(target, function (event) {
        if (number < 2 && event && (event.type === 'error' || event.type === 'timeout')) {
          setTimeout(function () { attempt(number + 1); }, 150 * (number + 1));
        } else {
          done(event);
        }
      }, key, chunkId);
    }
    return attempt(0);
  };
}

class ChunkLoadRecoveryPlugin {
  apply(compiler) {
    const { RuntimeModule, RuntimeGlobals } = compiler.webpack;
    class ChunkLoadRecoveryRuntime extends RuntimeModule {
      constructor() { super('blue bounded chunk load recovery', RuntimeModule.STAGE_TRIGGER); }
      generate() { return `(${installChunkRecovery.toString()})(${RuntimeGlobals.require});`; }
    }
    compiler.hooks.thisCompilation.tap('BlueChunkLoadRecovery', compilation => {
      compilation.hooks.runtimeRequirementInTree.for(RuntimeGlobals.loadScript).tap('BlueChunkLoadRecovery', chunk => {
        compilation.addRuntimeModule(chunk, new ChunkLoadRecoveryRuntime());
      });
    });
  }
}

module.exports = { FAILED_INITIAL_CHUNK_CLEANUP, installChunkRecovery, ChunkLoadRecoveryPlugin };
