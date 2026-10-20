const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Setting = require('../models/Setting');

const STUDIO_NOTICE_KEY = 'studioNotice';

// Accepts only a real calendar date written as YYYY-MM-DD (e.g. 2026-10-25).
function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function readDate(doc) {
  return doc && doc.value && typeof doc.value.date === 'string' ? doc.value.date : '';
}

// ---- Live push (Server-Sent Events) ----
// Every open website page keeps one small stream open here. When the admin saves,
// the new date is written to all of them at once, so pages update with no refresh.
// `now` is the server clock: pages use it (not the visitor's phone clock) to decide
// when the date has arrived.
const studioClients = new Set();

function sse(res, date) {
  res.write('event: studio-notice\ndata: ' + JSON.stringify({ date, now: Date.now() }) + '\n\n');
  if (typeof res.flush === 'function') res.flush(); // compression() buffers unless flushed
}

function broadcastStudioNotice(date) {
  for (const res of Array.from(studioClients)) {
    try { sse(res, date); } catch (err) { studioClients.delete(res); }
  }
}

// @desc   The "studio fully booked until <date>" notice shown in the home-page popup,
//         on the cart page, in the checkout popup and on the order-confirmation screen
// @route  GET /api/settings/studio-notice
// @access Public
exports.getStudioNotice = asyncHandler(async (req, res) => {
  const doc = await Setting.findOne({ key: STUDIO_NOTICE_KEY });
  res.json({ success: true, notice: { date: readDate(doc) }, now: Date.now() });
});

// @desc   Live stream of the studio-notice date (Server-Sent Events)
// @route  GET /api/settings/studio-notice/stream
// @access Public
exports.streamStudioNotice = asyncHandler(async (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform', // no-transform keeps compression from buffering the stream
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'                  // nginx: don't buffer
  });
  res.flushHeaders();
  res.write('retry: 15000\n\n');

  let ping = null;
  const cleanup = () => {
    if (ping) clearInterval(ping);
    studioClients.delete(res);
  };
  req.on('close', cleanup);

  // Tell the page the current date straight away, so it is in sync whenever it (re)connects.
  const doc = await Setting.findOne({ key: STUDIO_NOTICE_KEY });
  if (req.destroyed || res.writableEnded) return cleanup();
  sse(res, readDate(doc));
  studioClients.add(res);
  ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (err) { cleanup(); }
  }, 25000);
});

// @desc   Set (or clear, by sending an empty date) the studio-booked-until date
// @route  PUT /api/settings/studio-notice
// @access Private/Admin
exports.updateStudioNotice = asyncHandler(async (req, res) => {
  const raw = req.body && req.body.date;
  const date = typeof raw === 'string' ? raw.trim() : '';

  if (date && !isValidIsoDate(date)) {
    throw new ApiError(400, 'Please choose a valid date.');
  }

  const doc = await Setting.findOneAndUpdate(
    { key: STUDIO_NOTICE_KEY },
    { key: STUDIO_NOTICE_KEY, value: { date } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const saved = readDate(doc);
  broadcastStudioNotice(saved); // every open page updates instantly

  res.json({
    success: true,
    message: date ? 'Studio notice date saved.' : 'Studio notice removed.',
    notice: { date: saved },
    now: Date.now()
  });
});