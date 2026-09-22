const mongoose = require('mongoose');

/**
 * A single uploaded photo, stored as raw bytes in MongoDB (not on the local
 * filesystem). This is deliberate: both `localhost` and the live Render
 * deploy connect to the SAME MongoDB Atlas database, but each has its OWN,
 * separate local disk. Storing photos as plain files under /images meant an
 * upload only ever existed on whichever machine's disk received it — admin
 * uploads made on localhost were invisible on the live site and vice versa,
 * and (worse) anything uploaded on Render could vanish outright, since
 * Render's free-tier disk is wiped on every restart/redeploy. Keeping the
 * bytes in the shared database fixes both problems at once: any machine that
 * can reach the database can serve the image, and it survives redeploys.
 */
const uploadSchema = new mongoose.Schema(
  {
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Upload', uploadSchema);