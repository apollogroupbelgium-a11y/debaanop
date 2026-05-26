const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export async function onRequest(context) {
  const { env } = context;
  return json({
    ok: true,
    price: '4.95',
    accessDays: 7,
    hasDB: !!env.DB,
    hasMollieKey: !!env.MOLLIE_API_KEY,
    hasPublicSiteUrl: !!(env.PUBLIC_SITE_URL || env.SITE_URL),
    publicSiteUrl: env.PUBLIC_SITE_URL || env.SITE_URL || null
  });
}
