const express = require('./mobile/node_modules/express');
const path = require('path');

const app = express();
const PORT = 5000;
const DIST_DIR = path.join(__dirname, 'mobile', 'dist');

app.use(express.static(DIST_DIR, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[mobile] Arcadia Protocol serving on http://0.0.0.0:${PORT}`);
});
