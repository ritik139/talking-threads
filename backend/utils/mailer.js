/* ============================================================
   Mailer — sends the Contact page form + "New Order" notifications
   to the studio's inbox, via the Resend HTTP API (https://resend.com).

   Why Resend instead of Gmail/SMTP:
   - Talks over plain HTTPS (port 443), which almost never gets
     blocked by antivirus "mail shields", corporate firewalls, or
     ISPs the way raw SMTP (ports 25/465/587) commonly does.
   - No app passwords, no SMTP host/port juggling.

   Required env vars (see backend/.env):
     RESEND_API_KEY   — from https://resend.com/api-keys
     EMAIL_FROM       — the "from" address Resend sends as
                         (use onboarding@resend.dev while testing,
                         or an address on your verified domain in prod)
     CONTACT_TO_EMAIL — inbox that receives contact-form messages
     ADMIN_EMAIL      — inbox that receives "New Order" notifications
                         (falls back to CONTACT_TO_EMAIL if unset)

   Uses Node's built-in fetch (Node 18+), so no new npm dependency
   is required.
   ============================================================ */

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Performs a single POST attempt to Resend, with a timeout so a hung connection
// doesn't stall silently. Throws on both network-level failures and non-2xx responses.
async function attemptSend(payload, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    // "fetch failed" from undici is a generic wrapper — the actual reason (DNS error,
    // connection reset, TLS failure, timeout, etc.) lives on err.cause. Log it so
    // intermittent failures are diagnosable instead of just showing "fetch failed".
    const causeCode = err.cause && err.cause.code;
    const causeMessage = err.cause && err.cause.message;
    console.error(
      `Resend request failed at the network level: ${err.message}` +
      (causeCode ? ` (cause: ${causeCode}${causeMessage ? ` — ${causeMessage}` : ''})` : '')
    );
    const wrapped = new Error(`Resend request failed: ${err.message}${causeCode ? ` (${causeCode})` : ''}`);
    wrapped.isNetworkError = true;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    console.error(`Resend API returned an error — status ${res.status}: ${detail}`);
    throw new Error(`Resend API error (${res.status}): ${detail}`);
  }

  return res.json();
}

// Low-level call to Resend's REST API. Throws with a readable message on failure.
// Retries once on transient network-level failures (not on real API errors from
// Resend, e.g. bad request/auth, so we never risk sending the same email twice).
async function sendViaResend({ to, replyTo, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email is not configured — set RESEND_API_KEY in backend/.env.');

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('No sender configured — set EMAIL_FROM in backend/.env.');

  const payload = {
    from: `Talking-Thread Website <${from}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html
  };
  if (replyTo) payload.reply_to = replyTo;

  try {
    return await attemptSend(payload, apiKey);
  } catch (err) {
    if (!err.isNetworkError) throw err;
    console.warn('Retrying Resend send once after a network-level failure...');
    return attemptSend(payload, apiKey);
  }
}

// Called once at server startup — logs a warning instead of crashing if email isn't configured yet.
// Resend has no separate "verify connection" step, so this just checks that the required
// env vars are present.
async function verifyMailer() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Email is not configured (RESEND_API_KEY missing) — emails will not be able to send until backend/.env is set up.');
    return;
  }
  if (!process.env.EMAIL_FROM) {
    console.warn('Email is not fully configured (EMAIL_FROM missing) — set it in backend/.env.');
    return;
  }
  console.log('Resend mailer configured — contact form and order emails will be delivered via Resend.');
}

// Sends the contact-form submission to the studio's inbox (CONTACT_TO_EMAIL),
// with the visitor's address set as reply-to so a simple "Reply" answers them directly.
async function sendContactEmail({ name, email, subject, message }) {
  const to = process.env.CONTACT_TO_EMAIL;
  if (!to) throw new Error('No recipient configured — set CONTACT_TO_EMAIL in backend/.env.');

  const safeSubject = subject || 'General Enquiry';

  await sendViaResend({
    to,
    replyTo: `${name} <${email}>`,
    subject: `[Talking-Thread Contact] ${safeSubject} — ${name}`,
    text: [
      'New message from the Talking-Thread contact form',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${safeSubject}`,
      '',
      'Message:',
      message
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6;">
        <h2 style="margin:0 0 16px;">New Contact Form Message</h2>
        <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="margin:0 0 16px;"><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
        <p style="margin:0 0 6px;"><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;margin:0;">${escapeHtml(message)}</p>
      </div>
    `
  });
}

// Sends a "New Order" notification to the studio's inbox (ADMIN_EMAIL, falling back to
// CONTACT_TO_EMAIL) right after a customer successfully checks out.
async function sendNewOrderEmail({ order, customerName, customerEmail }) {
  const to = process.env.ADMIN_EMAIL || process.env.CONTACT_TO_EMAIL;
  if (!to) throw new Error('No recipient configured — set ADMIN_EMAIL in backend/.env.');

  const itemsText = order.items
    .map((i) => `  - ${i.qty} x ${i.name}${i.size ? ` (${i.size})` : ''}${i.color ? ` [${i.color}]` : ''} — ${i.price}`)
    .join('\n');

  const itemsHtml = order.items
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}${i.size ? ` (${escapeHtml(i.size)})` : ''}${i.color ? ` [${escapeHtml(i.color)}]` : ''}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(i.price)}</td>
        </tr>`
    )
    .join('');

  const customerPhone = (order.shippingAddress && order.shippingAddress.phone) || 'N/A';

  await sendViaResend({
    to,
    replyTo: customerEmail ? `${customerName || 'Customer'} <${customerEmail}>` : undefined,
    subject: `[Talking-Thread] New Order ${order.orderNumber}`,
    text: [
      `New order placed on Talking-Thread`,
      '',
      `Order: ${order.orderNumber}`,
      `Customer: ${customerName || 'N/A'} (${customerEmail || 'N/A'})`,
      `Phone: ${customerPhone}`,
      `Payment: ${order.paymentMethod} — ${order.paymentStatus}`,
      '',
      'Items:',
      itemsText,
      '',
      `Subtotal: ${order.subtotal}`,
      `Shipping: ${order.shipping}`,
      `Total: ${order.total}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6;">
        <h2 style="margin:0 0 16px;">New Order — ${escapeHtml(order.orderNumber)}</h2>
        <p style="margin:0 0 6px;"><strong>Customer:</strong> ${escapeHtml(customerName || 'N/A')} (${escapeHtml(customerEmail || 'N/A')})</p>
        <p style="margin:0 0 6px;"><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
        <p style="margin:0 0 16px;"><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)} — ${escapeHtml(order.paymentStatus)}</p>
        <table style="border-collapse:collapse;width:100%;max-width:480px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #222;">Item</th>
              <th style="text-align:center;padding:6px 10px;border-bottom:2px solid #222;">Qty</th>
              <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #222;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="margin:16px 0 0;"><strong>Subtotal:</strong> ${order.subtotal}</p>
        <p style="margin:0;"><strong>Shipping:</strong> ${order.shipping}</p>
        <p style="margin:0;"><strong>Total:</strong> ${order.total}</p>
      </div>
    `
  });
}

// Sends the order confirmation to the customer themselves, right after checkout —
// separate from sendNewOrderEmail above, which notifies the studio's own inbox.
// Both are fired from notifyNewOrder() in orderController.js so a single order
// always produces both emails.
async function sendOrderConfirmationEmail({ order, customerName, customerEmail }) {
  if (!customerEmail) throw new Error('No customer email on the order — cannot send confirmation.');

  const itemsText = order.items
    .map((i) => `  - ${i.qty} x ${i.name}${i.size ? ` (${i.size})` : ''}${i.color ? ` [${i.color}]` : ''} — ${i.price}`)
    .join('\n');

  const itemsHtml = order.items
    .map(
      (i) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}${i.size ? ` (${escapeHtml(i.size)})` : ''}${i.color ? ` [${escapeHtml(i.color)}]` : ''}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(i.price)}</td>
        </tr>`
    )
    .join('');

  const shippingLines = order.shippingAddress
    ? [
        order.shippingAddress.fullName,
        order.shippingAddress.line1,
        order.shippingAddress.line2,
        `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
        order.shippingAddress.country
      ].filter(Boolean)
    : [];

  await sendViaResend({
    to: customerEmail,
    subject: `Your Talking-Thread order ${order.orderNumber} is confirmed`,
    text: [
      `Thank you for shopping with Talking-Thread, ${customerName || 'there'}!`,
      '',
      `Order: ${order.orderNumber}`,
      `Payment: ${order.paymentMethod} — ${order.paymentStatus}`,
      '',
      'Items:',
      itemsText,
      '',
      `Subtotal: ${order.subtotal}`,
      `Shipping: ${order.shipping}`,
      `Total: ${order.total}`,
      '',
      shippingLines.length ? ['Shipping to:', ...shippingLines].join('\n') : '',
      '',
      'We hand-stitch every piece to order, so please allow 10–14 days before it ships.',
      'You can track this order any time from "My Orders" on the site.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6;">
        <h2 style="margin:0 0 16px;">Thank you for your order, ${escapeHtml(customerName || 'there')}!</h2>
        <p style="margin:0 0 16px;">Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been received and is being prepared by our artisans in Mumbai. We hand-stitch every piece to order, so please allow 10&ndash;14 days before it ships.</p>
        <table style="border-collapse:collapse;width:100%;max-width:480px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #222;">Item</th>
              <th style="text-align:center;padding:6px 10px;border-bottom:2px solid #222;">Qty</th>
              <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #222;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="margin:16px 0 0;"><strong>Subtotal:</strong> ${order.subtotal}</p>
        <p style="margin:0;"><strong>Shipping:</strong> ${order.shipping}</p>
        <p style="margin:0;"><strong>Total:</strong> ${order.total}</p>
        <p style="margin:0;"><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)} — ${escapeHtml(order.paymentStatus)}</p>
        ${shippingLines.length ? `<p style="margin:16px 0 0;"><strong>Shipping to:</strong><br>${shippingLines.map(escapeHtml).join('<br>')}</p>` : ''}
        <p style="margin:20px 0 0;">You can track this order any time from "My Orders" on the site.</p>
        <p style="margin:16px 0 0;">With thread and thanks,<br>Talking-Thread</p>
      </div>
    `
  });
}

// Sends a "New Subscriber" notification to the studio's inbox (ADMIN_EMAIL, falling back to
// CONTACT_TO_EMAIL) right after someone subscribes via any newsletter form on the site
// (homepage newsletter band, footer newsletter-mini, etc — they all hit the same
// POST /api/newsletter route). Mirrors sendNewOrderEmail's shape/fallback exactly.
async function sendNewsletterSubscriberEmail({ email }) {
  const to = process.env.ADMIN_EMAIL || process.env.CONTACT_TO_EMAIL;
  if (!to) throw new Error('No recipient configured — set ADMIN_EMAIL in backend/.env.');

  await sendViaResend({
    to,
    subject: `[Talking-Thread] New Newsletter Subscriber`,
    text: [
      'New newsletter subscriber on Talking-Thread',
      '',
      `Email: ${email}`
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6;">
        <h2 style="margin:0 0 16px;">New Newsletter Subscriber</h2>
        <p style="margin:0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      </div>
    `
  });
}

module.exports = { sendContactEmail, sendNewOrderEmail, sendOrderConfirmationEmail, sendNewsletterSubscriberEmail, verifyMailer };