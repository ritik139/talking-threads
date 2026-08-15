/* ============================================================
   WhatsApp notifier — sends "New Order" alerts to the client and
   order confirmations to customers over WhatsApp, using your own
   WhatsApp number (via whatsapp-web.js). No Meta/Facebook Business
   account, no template approval — just scan a QR code once, the
   same way you'd log into WhatsApp Web on a new device.

   IMPORTANT — this is an unofficial approach:
   - It automates your personal WhatsApp account the same way
     WhatsApp Web does. It is NOT WhatsApp's official Business API.
   - There is a small risk WhatsApp could flag/restrict the number
     for automated use. Risk is low at low message volumes (a few
     orders a day) but is not zero.
   - The session needs a persistent disk to survive server restarts
     (see WHATSAPP_SESSION_DIR below) and a Chromium browser
     installed in the deploy environment (see puppeteer note below).

   Required env vars (see backend/.env):
     ADMIN_WHATSAPP_NUMBER — client's WhatsApp number that receives
                              "New Order" alerts, in international
                              format with country code, digits only
                              (e.g. 917021312553 for +91 70213 12553)
     WHATSAPP_SESSION_DIR  — optional; folder to persist the login
                              session so you don't have to re-scan
                              the QR code on every restart. Defaults
                              to ./whatsapp-session inside backend/.

   First-time setup:
     1. Deploy this code.
     2. Watch the server logs — a QR code will print in the terminal.
     3. On your phone: WhatsApp → Settings → Linked Devices →
        Link a Device → scan that QR code.
     4. Logs will show "WhatsApp client is ready." — after that,
        order notifications go out automatically. The session is
        saved, so you should not need to re-scan unless you log out
        from your phone or the session folder is wiped.
   ============================================================ */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');

let client = null;
let isReady = false;
let initPromise = null;

// Normalizes a phone number to WhatsApp's chat-id format: digits only,
// with country code, plus "@c.us". Strips spaces, dashes, "+", parens.
// If the number looks like a bare 10-digit Indian mobile number (no
// country code), assumes +91 — since this store is India-based.
function toChatId(rawNumber) {
  if (!rawNumber) return null;
  let digits = String(rawNumber).replace(/[^\d]/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (!digits) return null;
  return `${digits}@c.us`;
}

function initWhatsApp() {
  if (initPromise) return initPromise;

  const sessionDir = process.env.WHATSAPP_SESSION_DIR || './whatsapp-session';

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('\n=== WhatsApp: scan this QR code with your phone (WhatsApp → Linked Devices → Link a Device) ===\n');
    qrcodeTerminal.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady = true;
    console.log('WhatsApp client is ready — order notifications will now be sent via WhatsApp.');
  });

  client.on('auth_failure', (msg) => {
    isReady = false;
    console.error('WhatsApp authentication failed:', msg);
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    console.warn('WhatsApp client disconnected:', reason, '— you may need to re-scan the QR code.');
  });

  initPromise = client.initialize().catch((err) => {
    console.error('WhatsApp client failed to initialize:', err.message);
  });

  return initPromise;
}

// Low-level send. Fire-and-forget callers (see below) already catch
// errors, but this also guards against calling before the client is
// ready (e.g. right after a fresh deploy, before the QR is scanned).
async function sendWhatsAppMessage(rawNumber, message) {
  if (!isReady || !client) {
    throw new Error('WhatsApp is not connected yet — scan the QR code in the server logs first.');
  }
  const chatId = toChatId(rawNumber);
  if (!chatId) throw new Error('No valid WhatsApp number to send to.');
  await client.sendMessage(chatId, message);
}

// Sends the "New Order" alert to the client's WhatsApp (ADMIN_WHATSAPP_NUMBER).
async function sendNewOrderWhatsApp({ order, customerName, customerPhone }) {
  const to = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!to) throw new Error('No recipient configured — set ADMIN_WHATSAPP_NUMBER in backend/.env.');

  const itemsText = order.items
    .map((i) => `- ${i.qty} x ${i.name}${i.size ? ` (${i.size})` : ''} — ${i.price}`)
    .join('\n');

  const message = [
    `🧵 *New Order — ${order.orderNumber}*`,
    '',
    `Customer: ${customerName || 'N/A'}`,
    `Phone: ${customerPhone || 'N/A'}`,
    '',
    'Items:',
    itemsText,
    '',
    `Total: ${order.total}`
  ].join('\n');

  await sendWhatsAppMessage(to, message);
}

// Sends the order confirmation to the customer's own WhatsApp number.
async function sendOrderConfirmationWhatsApp({ order, customerName, customerPhone }) {
  if (!customerPhone) throw new Error('No customer phone on the order — cannot send WhatsApp confirmation.');

  const itemsText = order.items
    .map((i) => `- ${i.qty} x ${i.name}${i.size ? ` (${i.size})` : ''} — ${i.price}`)
    .join('\n');

  const message = [
    `Thank you for shopping with Talking-Thread, ${customerName || 'there'}! 🧵`,
    '',
    `Order: ${order.orderNumber}`,
    '',
    'Items:',
    itemsText,
    '',
    `Total: ${order.total}`,
    '',
    'We hand-stitch every piece to order, so please allow 10–14 days before it ships.',
    'You can track this order any time from "My Orders" on the site.'
  ].join('\n');

  await sendWhatsAppMessage(customerPhone, message);
}

module.exports = {
  initWhatsApp,
  sendNewOrderWhatsApp,
  sendOrderConfirmationWhatsApp
};