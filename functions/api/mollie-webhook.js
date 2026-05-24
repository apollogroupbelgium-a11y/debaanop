const ACCESS_HOURS = 24 * 7;
const text = (message, status = 200) => new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.MOLLIE_API_KEY || !env.DB) return text('Missing configuration', 500);

    const body = await request.text();
    const params = new URLSearchParams(body);
    const paymentId = params.get('id');
    if (!paymentId) return text('No payment id', 400);

    const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${env.MOLLIE_API_KEY}` }
    });
    if (!mollieRes.ok) return text('Could not verify payment', 500);

    const payment = await mollieRes.json();
    const row = await env.DB.prepare(`SELECT * FROM access_tokens WHERE payment_id = ?`).bind(paymentId).first();
    if (!row) return text('Payment not found', 404);

    if (payment.status === 'paid') {
      const expiresAt = Date.now() + ACCESS_HOURS * 60 * 60 * 1000;
      await env.DB.prepare(`UPDATE access_tokens SET status = ?, paid_at = ?, expires_at = ? WHERE payment_id = ?`).bind('paid', Date.now(), expiresAt, paymentId).run();
    } else {
      await env.DB.prepare(`UPDATE access_tokens SET status = ? WHERE payment_id = ?`).bind(payment.status || 'unknown', paymentId).run();
    }

    return text('OK');
  } catch (error) {
    return text(error.message || 'Webhook error', 500);
  }
}
