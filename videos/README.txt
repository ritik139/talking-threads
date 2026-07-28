Place your real studio/process video file in this folder as an MP4, e.g. studio-process.mp4

Then open index.html, find the video section (search for "video-section"), and point the
<source> tag at your file:

  <source src="videos/studio-process.mp4" type="video/mp4">

Tips for a fast-loading, premium result:
- Keep the clip short (10-20 seconds is plenty since it loops).
- Export at 1080p, H.264, and compress it (aim for under 5-8MB) using a free tool like
  HandBrake (handbrake.fr) so it loads quickly for visitors on slower connections.
- The "poster" attribute on the <video> tag shows a still image until the video is ready —
  update it to any real photo in the images/ folder for a polished first frame.