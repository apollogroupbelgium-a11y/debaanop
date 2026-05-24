const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

export async function onRequest(context) {
  const { request, env } = context;

  // Sommige deployments/browsers/proxies komen hier als GET terecht.
  // Daarom ondersteunen we bewust zowel GET als POST, zodat de betaalknop niet op 405 valt.
  if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) {
    return json({ error: 'Methode niet toegestaan. Gebruik GET of POST.' }, 405);
  }
  if (request.method === 'OPTIONS') return json({ ok: true });

  try {
    if (!env.MOLLIE_API_KEY) {
      return json({ error: 'MOLLIE_API_KEY ontbreekt in Cloudflare Pages → Settings → Environment variables.' }, 500);
    }

    const rawSiteUrl = env.PUBLIC_SITE_URL || env.SITE_URL;
    if (!rawSiteUrl) {
      return json({ error: 'PUBLIC_SITE_URL ontbreekt in Cloudflare. Voeg deze toe, bv. https://jouw-site.pages.dev' }, 500);
    }

    if (!env.DB) {
      return json({ error: 'D1 binding DB ontbreekt in Cloudflare Pages → Settings → Bindings.' }, 500);
    }

    const accessToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const siteUrl = rawSiteUrl.replace(/\/$/, '');
    const createdAt = Date.now();

    const paymentPayload = {
      amount: { currency: 'EUR', value: '9.95' },
      description: 'Rijbewijs B oefenen - 7 dagen toegang',
      redirectUrl: `${siteUrl}/betaald.html?access=${accessToken}`,
      webhookUrl: `${siteUrl}/api/mollie-webhook`,
      metadata: { accessToken, product: 'rijbewijs-b-7-dagen' }
    };

    const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MOLLIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    });

    const mollieText = await mollieRes.text();
    let payment = {};
    try {
      payment = mollieText ? JSON.parse(mollieText) : {};
    } catch (e) {
      return json({ error: 'Mollie gaf geen geldig JSON-antwoord terug.', raw: mollieText }, 500);
    }

    if (!mollieRes.ok) {
      return json({ error: 'Mollie betaling kon niet worden aangemaakt.', status: mollieRes.status, details: payment }, 500);
    }

    const checkoutUrl = payment?._links?.checkout?.href;
    if (!checkoutUrl) {
      return json({ error: 'Mollie gaf geen checkout-link terug.', details: payment }, 500);
    }

    await env.DB.prepare(`INSERT INTO access_tokens (access_token, payment_id, status, created_at, expires_at, amount) VALUES (?, ?, ?, ?, ?, ?)`).bind(
      accessToken,
      payment.id,
      payment.status || 'created',
      createdAt,
      null,
      '9.95'
    ).run();

    return json({ ok: true, checkoutUrl, accessToken });
  } catch (error) {
    return json({ error: error.message || 'Onbekende fout bij betaling.' }, 500);
  }
}
