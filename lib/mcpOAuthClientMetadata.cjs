'use strict';

// Public application identity only: no auth, ledger, database or Redis access.
const ORIGIN = 'https://blue.imergene.in';
const CLIENT_PATH = '/api/mcp/client-metadata';
function mcpOAuthClientMetadata(requestUrl) {
  let request;
  try { request = new URL(requestUrl); } catch { return null; }
  const port = request.searchParams.get('port'), callback = request.searchParams.get('callback');
  if (request.pathname !== CLIENT_PATH || [...request.searchParams.keys()].length !== 2
    || request.searchParams.getAll('port').length !== 1 || request.searchParams.getAll('callback').length !== 1
    || !/^[1-9][0-9]{3,4}$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535
    || !/^[A-Za-z0-9_-]{12}$/.test(callback || '')) return null;
  const clientId = `${ORIGIN}${CLIENT_PATH}?port=${port}&callback=${callback}`;
  return {
    client_id: clientId, client_name: 'Blue', client_uri: ORIGIN,
    logo_uri: `${ORIGIN}/images/blue-oauth-icon.png`,
    redirect_uris: [`http://127.0.0.1:${port}/callback/${callback}`],
    application_type: 'native', token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code']
  };
}
module.exports = { mcpOAuthClientMetadata };
