const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = sessionStorage.getItem('tk');
const api = (url, opt = {}) => fetch(url, { ...opt, headers: { ...(opt.headers || {}), 'x-token': token } }).then(r => { if (r.status === 401) { logout(); throw 0; } return r.json(); });

async function login() {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
  if (!r.ok) return $('#lm').textContent = 'Wrong password';
  token = (await r.json()).token; sessionStorage.setItem('tk', token); show();
}
function logout() { sessionStorage.removeItem('tk'); location.reload(); }
function show() { $('#login').classList.add('hide'); $('#panel').classList.remove('hide'); loadAll(); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['gal', 'rev', 'inq'].forEach(t => $('#' + t).classList.toggle('hide', t !== b.dataset.t));
});
async function loadAll() {
  const [g, r, i] = await Promise.all([fetch('/api/gallery').then(r => r.json()), fetch('/api/reviews').then(r => r.json()), api('/api/inquiries')]);
  $('#thumbs').innerHTML = g.map(x => `<div><img src="${esc(x.url)}"><small>${esc(x.category)}</small><button class="del" onclick="del('gallery','${x.id}')">Delete</button></div>`).join('');
  $('#rev').innerHTML = r.map(x => `<div class="card"><div class="stars">${'★'.repeat(x.rating)}</div><em>"${esc(x.text)}"</em><strong>— ${esc(x.name)}</strong> <small>${new Date(x.date).toLocaleDateString()}</small><br><button class="del" onclick="del('reviews','${x.id}')">Delete</button></div>`).join('') || '<p>No reviews yet.</p>';
  $('#cnt').textContent = i.length ? `(${i.length})` : '';
  $('#inq').innerHTML = i.map(x => {
    const wa = 'https://wa.me/91' + x.phone.replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent('Hi ' + x.name + ', thanks for your inquiry about ' + x.eventType + '.');
    return `<div class="card"><h3>${esc(x.name)} <small style="color:var(--mute)">${new Date(x.date).toLocaleString()}</small></h3>
    <p>📞 ${esc(x.phone)} ${x.email ? '| ✉ ' + esc(x.email) : ''}<br>🎬 ${esc(x.eventType)} ${x.eventDate ? '| 📅 ' + esc(x.eventDate) : ''}<br>${esc(x.message)}</p>
    <a href="${wa}" target="_blank" class="btn" style="padding:8px 20px">Reply on WhatsApp</a> <button class="del" onclick="del('inquiries','${x.id}')">Delete</button></div>`;
  }).join('') || '<p>No inquiries yet.</p>';
}
async function shrink(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}
async function upload() {
  const f = [...$('#files').files]; if (!f.length) return $('#um').textContent = 'Choose images first';
  try {
    for (let n = 0; n < f.length; n++) {
      $('#um').textContent = `Uploading ${n + 1} of ${f.length}...`;
      const fd = new FormData(); fd.append('images', await shrink(f[n]), 'photo.jpg'); fd.append('category', $('#cat').value);
      const r = await api('/api/gallery', { method: 'POST', body: fd }); if (r.error) throw new Error(r.error);
    }
    $('#files').value = ''; $('#um').textContent = '✓ Uploaded'; loadAll();
  } catch (e) { $('#um').textContent = 'Upload failed: ' + (e.message || 'error'); }
}
async function del(type, id) { if (confirm('Delete this?')) { await api(`/api/${type}/${id}`, { method: 'DELETE' }); loadAll(); } }
$('#pw').addEventListener('keydown', e => e.key === 'Enter' && login());
if (token) show();
