// supabase/functions/_shared/cors.ts
export function makeCorsHeaders(origin?: string) {
  // allowlist (dev + prod). Add your domains here.
  const ALLOW = new Set([
    "http://localhost:3000",
    // "https://yourapp.com",
    // "https://staging.yourapp.com",
  ]);
  const allowOrigin = origin && ALLOW.has(origin) ? origin : "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
