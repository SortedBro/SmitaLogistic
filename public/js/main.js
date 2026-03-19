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
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }, 5000);
});

// ── Active nav link highlight ─────────────────
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.href === window.location.href) a.classList.add('active');
});

// ── Admin sidebar active link ──────────────────
document.querySelectorAll('.admin-nav-link').forEach(a => {
  if (window.location.pathname.startsWith(a.getAttribute('href'))) {
    a.classList.add('active');
  }
});