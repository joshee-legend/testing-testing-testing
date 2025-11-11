/* Save as assets/js/app.js
   Frontend-only JS: renders predictions, search, filter, and responsive sidebar.
   It uses a sample dataset; if /api/get_predictions.php exists the script will
   attempt to fetch real data instead.
*/

const predictionsEl = document.getElementById('predictions');
const searchInput = document.getElementById('search');
const limitSelect = document.getElementById('limit');
const refreshBtn = document.getElementById('refreshBtn');
const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const mobileClose = document.getElementById('mobileClose');
const emptyState = document.getElementById('emptyState');

let dataStore = []; // loaded predictions
let currentFilter = 'all';

const sampleData = [
  { id:1, match_date: getFutureDateISO(1, '19:00'), league:'UEFA Champions League', team_home:'Team A', team_away:'Team B', odds:'1.85', tip:'1' },
  { id:2, match_date: getFutureDateISO(1, '21:00'), league:'Premier League', team_home:'Team C', team_away:'Team D', odds:'2.10', tip:'X' },
  { id:3, match_date: getFutureDateISO(2, '16:00'), league:'La Liga', team_home:'Team E', team_away:'Team F', odds:'1.60', tip:'2' },
  { id:4, match_date: getFutureDateISO(4, '18:30'), league:'Serie A', team_home:'Team G', team_away:'Team H', odds:'2.50', tip:'BTTS' },
  { id:5, match_date: getFutureDateISO(6, '17:00'), league:'Friendly', team_home:'Team I', team_away:'Team J', odds:'1.95', tip:'1' }
];

function getFutureDateISO(daysAhead=0, time='19:00'){
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const [h,m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/* Try fetch from backend API; fallback to sample data */
async function loadPredictions(){
  // optimistic: show sample immediately for snappiness
  dataStore = sampleData.slice();
  render();

  // Try real API if present
  try {
    const resp = await fetch('api/get_predictions.php?limit=50', {cache:'no-store'});
    if (!resp.ok) throw new Error('no api');
    const json = await resp.json();
    if (json && json.status === 'ok' && Array.isArray(json.predictions)) {
      // normalize to same shape if needed
      dataStore = json.predictions.map((p, i) => ({
        id: p.id ?? i+100,
        match_date: p.match_date,
        league: p.league ?? p.league,
        team_home: p.team_home ?? p.team_home,
        team_away: p.team_away ?? p.team_away,
        odds: p.odds ?? p.odds,
        tip: p.tip ?? p.tip
      }));
      render();
    }
  } catch (err) {
    // no backend available — fine, keep sample data
    // console.log('API not available, using sample data');
  }
}

/* Render UI */
function render(){
  const q = (searchInput.value || '').trim().toLowerCase();
  const limit = parseInt(limitSelect.value || '20', 10);
  let items = dataStore.slice();

  // filter by nav (today/tomorrow/weekend)
  const now = new Date();
  if (currentFilter === 'today') {
    items = items.filter(i => isSameDay(new Date(i.match_date), now));
  } else if (currentFilter === 'tomorrow') {
    const t = new Date(now); t.setDate(t.getDate()+1);
    items = items.filter(i => isSameDay(new Date(i.match_date), t));
  } else if (currentFilter === 'weekend') {
    items = items.filter(i => {
      const d = new Date(i.match_date);
      const day = d.getDay(); // 0 Sun, 6 Sat
      return day === 6 || day === 0;
    });
  }

  // search
  if (q) {
    items = items.filter(i =>
      (i.league || '').toLowerCase().includes(q) ||
      (i.team_home || '').toLowerCase().includes(q) ||
      (i.team_away || '').toLowerCase().includes(q)
    );
  }

  // sort by date ascending
  items.sort((a,b) => new Date(a.match_date) - new Date(b.match_date));

  // limit
  items = items.slice(0, limit);

  // render
  if (!items.length) {
    predictionsEl.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  predictionsEl.innerHTML = items.map(renderCard).join('');
}

function renderCard(i) {
  const d = new Date(i.match_date);
  const dateStr = formatDate(d);
  return `
  <article class="card" tabindex="0" aria-label="${i.team_home} vs ${i.team_away} on ${dateStr}">
    <div class="meta">${escapeHtml(i.league || '—')} • ${dateStr}</div>
    <div class="teams">
      <div class="team">
        <div class="name">${escapeHtml(i.team_home)}</div>
        <div class="muted">${i.tip ? 'Tip: ' + escapeHtml(i.tip) : ''}</div>
      </div>
      <div class="vs">vs</div>
      <div class="team" style="text-align:right">
        <div class="name">${escapeHtml(i.team_away)}</div>
        <div class="muted">${i.odds ? 'Odds: ' + escapeHtml(i.odds) : ''}</div>
      </div>
    </div>
    <div class="odds">
      <div class="tip">Tip: ${escapeHtml(i.tip || '-')}</div>
      <div class="time">${timeAgoOrDate(d)}</div>
    </div>
  </article>
  `;
}

/* Helpers */
function isSameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function pad(n){return n<10?'0'+n:n}
function formatDate(d){
  // e.g. Nov 06 • 19:00
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${pad(d.getDate())} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function timeAgoOrDate(d){
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'Started';
  const hours = Math.floor(diff / (1000*60*60));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours/24);
  return `${days}d`;
}
function escapeHtml(s){
  if (!s && s !== 0) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

/* Events */
searchInput.addEventListener('input', debounce(render, 220));
limitSelect.addEventListener('change', render);
refreshBtn.addEventListener('click', loadPredictions);

// Nav buttons
navButtons.forEach(b=>{
  b.addEventListener('click', ()=>{
    navButtons.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    currentFilter = b.dataset.filter || 'all';
    render();
  });
});

// Mobile sidebar toggles
mobileMenuBtn && mobileMenuBtn.addEventListener('click', ()=> sidebar.classList.add('open'));
mobileClose && mobileClose.addEventListener('click', ()=> sidebar.classList.remove('open'));

// keyboard accessible: close sidebar ESC
document.addEventListener('keydown', (e)=> { if (e.key === 'Escape') sidebar.classList.remove('open'); });

/* Init */
loadPredictions();

/* Utility: debounce */
function debounce(fn, ms=200){
  let t;
  return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
}


<script>

</script>
