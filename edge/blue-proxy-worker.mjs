import { handleBlueProxy } from '../lib/blueInferenceProxy.mjs';

export default {
  fetch(request, env, context) {
    return handleBlueProxy(request, { env, waitUntil: work => context.waitUntil(work) });
  }
};
