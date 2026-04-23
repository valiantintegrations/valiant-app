// Returns Google Maps configuration to the frontend.
// The API key itself is restricted by HTTP referrer on Google's side,
// so exposing it here is safe (it only works from our domains anyway).
// This endpoint lets us avoid hardcoding the key in the public app.js.
export default function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return res.status(200).json({
      configured: false,
      error: 'GOOGLE_MAPS_API_KEY not set in Vercel environment variables'
    });
  }
  return res.status(200).json({
    configured: true,
    apiKey: key
  });
}
