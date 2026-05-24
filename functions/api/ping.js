export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    hasDB: !!env.DB,
    hasMollieKey: !!env.MOLLIE_API_KEY,
    hasPublicSiteUrl: !!(env.PUBLIC_SITE_URL || env.SITE_URL)
  }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
