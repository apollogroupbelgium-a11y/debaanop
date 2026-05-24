const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const ACCESS_HOURS = 24 * 7;

async function markPaid(env, row) {
  const expiresAt = Date.now() + ACCESS_HOURS * 60 * 60 * 1000;
  await env.DB.prepare(`UPDATE access_tokens SET status = ?, paid_at = ?, expires_at = ? WHERE access_token = ?`).bind('paid', Date.now(), expiresAt, row.access_token).run();
  return expiresAt;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) return json({ valid: false, error: 'D1 binding DB ontbreekt.' }, 500);
    const url = new URL(request.url);
    const access = url.searchParams.get('access');
    if (!access) return json({ valid: false, status: 'missing' }, 400);

    const row = await env.DB.prepare(`SELECT * FROM access_tokens WHERE access_token = ?`).bind(access).first();
    if (!row) return json({ valid: false, status: 'unknown' }, 404);

    if (row.status === 'paid' && row.expires_at && Number(row.expires_at) > Date.now()) {
      return json({ valid: true, status: 'paid', expiresAt: new Date(Number(row.expires_at)).toISOString() });
    }

    // Extra controle voor het geval de Mollie webhook vertraagd of gemist werd.
    if (row.payment_id && env.MOLLIE_API_KEY && row.status !== 'paid') {
      const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${row.payment_id}`, {
        headers: { 'Authorization': `Bearer ${env.MOLLIE_API_KEY}` }
      });
      if (mollieRes.ok) {
        const payment = await mollieRes.json();
        await env.DB.prepare(`UPDATE access_tokens SET status = ? WHERE access_token = ?`).bind(payment.status, access).run();
        if (payment.status === 'paid') {
          const expiresAt = await markPaid(env, row);
          return json({ valid: true, status: 'paid', expiresAt: new Date(expiresAt).toISOString() });
        }
        return json({ valid: false, status: payment.status || 'pending' });
      }
    }

    return json({ valid: false, status: row.status || 'pending' });
  } catch (error) {
    return json({ valid: false, error: error.message || 'Onbekende fout.' }, 500);
  }
}
