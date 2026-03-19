// ════════════════════════════════════════════
//  SmitaLogistic — main.js
// ════════════════════════════════════════════

// ── Dark / Light Theme Toggle ─────────────────
function toggleTheme() {
  const html    = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  localStorage.setItem('sl-theme', next);
}

// Apply saved theme immediately (also done inline in head.ejs)
(function () {
  const t = localStorage.getItem('sl-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();

// ── Mobile Nav ────────────────────────────────
function toggleNav() {
  document.getElementById('mobile-nav')?.classList.toggle('open');
}
function closeNav() {
  document.getElementById('mobile-nav')?.classList.remove('open');
}

// ── Scroll Reveal ─────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── Auto-hide flash messages ───────────────────
document.querySelectorAll('.flash').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity .5s';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 500);
  }, 5000);
});

// ── Active nav link ───────────────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.href === window.location.href) a.classList.add('active');
});

// ── Admin sidebar active link ──────────────────
document.querySelectorAll('.admin-nav-link').forEach(a => {
  if (a.getAttribute('href') && window.location.pathname.startsWith(a.getAttribute('href'))) {
    a.classList.add('active');
  }
});