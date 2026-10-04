const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('#yr').textContent = new Date().getFullYear();
let gallery = [], cat = 'All';

function renderGallery() {
  const cats = ['All', ...new Set(gallery.map(g => g.category))];
  $('#filters').innerHTML = cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('#gallery-grid').innerHTML = gallery.filter(g => cat === 'All' || g.category === cat)
    .map(g => `<img src="${esc(g.url)}" alt="${esc(g.category)} photography" loading="lazy" onerror="this.remove()">`).join('');
}
$('#filters').onclick = e => { if (e.target.dataset.c) { cat = e.target.dataset.c; renderGallery(); } };
$('#gallery-grid').onclick = e => { if (e.target.tagName === 'IMG') { $('#lb-img').src = e.target.src; $('#lb').classList.add('show'); } };
$('#lb').onclick = () => $('#lb').classList.remove('show');

async function loadReviews() {
  const r = await (await fetch('/api/reviews')).json();
  $('#reviews-grid').innerHTML = r.map(x => `<div class="card"><div class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</div><em>"${esc(x.text)}"</em><strong>— ${esc(x.name)}</strong></div>`).join('');
}
async function post(url, form, msgEl, okText) {
  const m = $(msgEl); m.textContent = 'Sending...';
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    if (!r.ok) throw 0;
    form.reset(); m.textContent = okText; return true;
  } catch { m.textContent = 'Something went wrong. Please WhatsApp 9888877067.'; }
}
$('#inq-form').onsubmit = e => { e.preventDefault(); post('/api/inquiries', e.target, '#inq-msg', '✓ Inquiry sent! Manjit will contact you soon.'); };
$('#review-form').onsubmit = async e => { e.preventDefault(); if (await post('/api/reviews', e.target, '#review-msg', '✓ Thank you for your review!')) loadReviews(); };

fetch('/api/gallery').then(r => r.json()).then(d => { gallery = d; renderGallery(); });
loadReviews();
