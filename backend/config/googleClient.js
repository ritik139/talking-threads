const { OAuth2Client } = require('google-auth-library');

// Works for both localhost and production: if GOOGLE_CALLBACK_URL is set, use it as-is;
// otherwise derive it from whatever host the request actually came in on.
function resolveCallbackUrl(req) {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}/api/auth/google/callback`;
}

function getGoogleClient(req) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return null; // not configured yet — caller should respond with a clear error
  }
  const redirectUri = resolveCallbackUrl(req);
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
  return { client, redirectUri };
}

module.exports = { getGoogleClient, resolveCallbackUrl };