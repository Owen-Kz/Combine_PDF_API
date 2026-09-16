// routes/files.js
const express = require('express');
const axios = require('axios');
const path = require('path');
const router = express.Router();

const ALLOWED_HOSTS = new Set([
  'process.asfirj.org',
  'asfirj.org',
  'www.asfirj.org',
  'localhost',
  '127.0.0.1',
  'res.cloudinary.com',
]);

router.get('/download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }

  // Prevent open-proxy abuse: only allow known hosts.
  // Use hostname (no port) so localhost:31000 matches 'localhost'.
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ error: 'host not allowed' });
  }

  try {
    const upstream = await axios.get(url, {
      responseType: 'stream',
      // If the remote requires auth, attach a service token here.
      // headers: { Authorization: `Bearer ${process.env.SERVICE_TOKEN}` }
    });

    const remoteName = path.basename(parsed.pathname) || 'file';
    const remoteExt = path.extname(remoteName);
    const label = (filename || '').trim();

    // Prefer the friendly label, keeping the remote file's extension when
    // the label doesn't already carry one; otherwise use the remote name.
    let safeName = label
      ? (remoteExt && !path.extname(label) ? `${label}${remoteExt}` : label)
      : remoteName;

    safeName = String(safeName)
      .replace(/[^\w.\-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"`
    );
    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    }

    upstream.data.pipe(res);
  } catch (err) {
    console.error('Proxy download failed:', err.message);
    res.status(502).json({ error: 'Failed to fetch remote file' });
  }
});

module.exports = router;