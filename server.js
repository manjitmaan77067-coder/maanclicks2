const express = require('express'), multer = require('multer'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const app = express();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'manjit@123').trim(); // set ADMIN_PASSWORD in Vercel settings
const DB = path.join(__dirname, 'data.json'), UP = path.join(__dirname, 'public', 'uploads');
const envFind = re => process.env[Object.keys(process.env).find(k => re.test(k)) || ''];
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || envFind(/(KV_REST_API_URL|REDIS_REST_URL)$/);
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || envFind(/(KV_REST_API_TOKEN|REDIS_REST_TOKEN)$/);
const BLOB = process.env.BLOB_READ_WRITE_TOKEN || process.env[Object.keys(process.env).find(k => /READ_WRITE_TOKEN$/.test(k)) || '']; // also accepts a prefixed name
const U = id => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;
const seed = {
  gallery: [
    ['photo-1519741497674-611481863552','Wedding'],['photo-1511285560929-80b456fea0bc','Wedding'],
    ['photo-1537633552985-df8429e8048b','Wedding'],['photo-1606216794074-735e91aa2c92','Pre-Wedding'],
    ['photo-1583939003579-730e3918a45a','Pre-Wedding'],['photo-1465495976277-4387d4b0b4c6','Wedding'],
    ['photo-1522673607200-164d1b6ce486','Events'],['photo-1529636798458-92182e662485','Portrait']
  ].map(([id, cat], i) => ({ id: 's' + i, url: U(id), category: cat })),
  reviews: [
    ['Simran & Arjun','Manjit captured our wedding like a movie. Every emotion is in the frames!',5],
    ['Harpreet Kaur','Super professional and so friendly. Our pre-wedding shoot turned out stunning.',5],
    ['Gurpreet Sandhu','Video edit was cinematic. Delivered on time and the whole family loved it.',5],
    ['Navneet & Riya','Best photographer in the area. Candid shots were beyond our expectations.',5],
    ['Amandeep Brar','Great quality, great price and great vibes on the day. Highly recommended!',4]
  ].map(([name, text, rating], i) => ({ id: 'r' + i, name, text, rating, date: new Date().toISOString() })),
  inquiries: [],
  products: []
};

// ---- storage: Upstash Redis on Vercel, data.json file when running locally ----
async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + REDIS_TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
async function load(key) {
  if (REDIS_URL) {
    const v = await redis(['GET', key]);
    if (v) return JSON.parse(v);
    await redis(['SET', key, JSON.stringify(seed[key])]); return seed[key];
  }
  if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(seed, null, 2));
  return JSON.parse(fs.readFileSync(DB))[key] || seed[key];
}
async function save(key, val) {
  if (REDIS_URL) return redis(['SET', key, JSON.stringify(val)]);
  const d = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { ...seed }; d[key] = val; fs.writeFileSync(DB, JSON.stringify(d, null, 2));
}
// ---- stateless admin token (works across serverless instances) ----
const sign = t => crypto.createHmac('sha256', 'salt:' + ADMIN_PASSWORD).update(t).digest('hex');
const makeToken = () => { const e = String(Date.now() + 12 * 3600e3); return e + '.' + sign(e); };
const auth = (req, res, next) => {
  const [e, h] = String(req.headers['x-token'] || '').split('.');
  return e && h && +e > Date.now() && h === sign(e) ? next() : res.status(401).json({ error: 'Unauthorized' });
};
const uid = () => crypto.randomBytes(12).toString('hex');
const clean = (s, n = 500) => String(s || '').trim().slice(0, n);
const wrap = fn => (req, res, next) => fn(req, res).catch(next);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, /^image\//.test(f.mimetype)) });

async function storeFile(f) {
  if (BLOB) {
    const { put } = await import('@vercel/blob');
    return (await put('shop/' + Date.now() + '-' + uid() + '.jpg', f.buffer, { access: 'public', contentType: f.mimetype, token: BLOB })).url;
  }
  fs.mkdirSync(UP, { recursive: true }); const n = Date.now() + path.extname(f.originalname).toLowerCase();
  fs.writeFileSync(path.join(UP, n), f.buffer); return '/uploads/' + n;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (q, res) => res.json({ passwordFromVercel: !!process.env.ADMIN_PASSWORD, redis: !!REDIS_URL, blob: !!BLOB }));
app.post('/api/login', (req, res) => {
  if (String(req.body.password || '').trim() !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: makeToken() });
});
app.get('/api/gallery', wrap(async (q, res) => res.json(await load('gallery'))));
app.post('/api/gallery', auth, upload.array('images', 10), wrap(async (req, res) => {
  const d = await load('gallery'), cat = clean(req.body.category, 30) || 'Wedding';
  for (const f of req.files || []) {
    let url;
    if (BLOB) {
      const { put } = await import('@vercel/blob');
      url = (await put('gallery/' + Date.now() + '-' + uid() + '.jpg', f.buffer, { access: 'public', contentType: f.mimetype, token: BLOB })).url;
    } else { // local development only
      fs.mkdirSync(UP, { recursive: true }); const n = Date.now() + path.extname(f.originalname).toLowerCase();
      fs.writeFileSync(path.join(UP, n), f.buffer); url = '/uploads/' + n;
    }
    d.unshift({ id: uid(), url, category: cat });
  }
  await save('gallery', d); res.json({ ok: true });
}));
app.delete('/api/gallery/:id', auth, wrap(async (req, res) => {
  const d = await load('gallery'), img = d.find(g => g.id === req.params.id);
  if (img && BLOB && img.url.includes('blob.vercel-storage.com')) { try { const { del } = await import('@vercel/blob'); await del(img.url, { token: BLOB }); } catch (e) {} }
  if (img && img.url.startsWith('/uploads/')) fs.unlink(path.join(UP, path.basename(img.url)), () => {});
  await save('gallery', d.filter(g => g.id !== req.params.id)); res.json({ ok: true });
}));
app.get('/api/reviews', wrap(async (q, res) => res.json(await load('reviews'))));
app.post('/api/reviews', wrap(async (req, res) => {
  const name = clean(req.body.name, 60), text = clean(req.body.text, 400), rating = Math.min(5, Math.max(1, +req.body.rating || 5));
  if (!name || !text) return res.status(400).json({ error: 'Name and review required' });
  const d = await load('reviews'); d.unshift({ id: uid(), name, text, rating, date: new Date().toISOString() });
  await save('reviews', d); res.json({ ok: true });
}));
app.delete('/api/reviews/:id', auth, wrap(async (req, res) => { await save('reviews', (await load('reviews')).filter(r => r.id !== req.params.id)); res.json({ ok: true }); }));
app.post('/api/inquiries', wrap(async (req, res) => {
  const b = req.body, name = clean(b.name, 60), phone = clean(b.phone, 20);
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const d = await load('inquiries');
  d.unshift({ id: uid(), name, phone, email: clean(b.email, 80), eventType: clean(b.eventType, 40), eventDate: clean(b.eventDate, 20), message: clean(b.message, 1000), date: new Date().toISOString() });
  await save('inquiries', d); res.json({ ok: true });
}));
app.get('/api/inquiries', auth, wrap(async (q, res) => res.json(await load('inquiries'))));
app.delete('/api/inquiries/:id', auth, wrap(async (req, res) => { await save('inquiries', (await load('inquiries')).filter(i => i.id !== req.params.id)); res.json({ ok: true }); }));

app.get('/api/products', wrap(async (q, res) => res.json(await load('products'))));
app.post('/api/products', auth, upload.single('image'), wrap(async (req, res) => {
  const name = clean(req.body.name, 80), price = clean(req.body.price, 20);
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  const d = await load('products');
  d.unshift({ id: uid(), name, price, description: clean(req.body.description, 400), mrp: clean(req.body.mrp, 20), category: clean(req.body.category, 40), badge: clean(req.body.badge, 20), image: req.file ? await storeFile(req.file) : '', date: new Date().toISOString() });
  await save('products', d); res.json({ ok: true });
}));
app.delete('/api/products/:id', auth, wrap(async (req, res) => { await save('products', (await load('products')).filter(p => p.id !== req.params.id)); res.json({ ok: true }); }));

app.use((err, req, res, next) => { console.error('ERROR:', err.message); res.status(500).json({ error: err.message }); });

module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Site: http://localhost:${PORT}  |  Admin: http://localhost:${PORT}/admin.html`));
}
