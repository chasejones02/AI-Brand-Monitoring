  // ── 2-step form flow ─────────────────────────────────────
  const MAX_QUERIES = 10;

  function showStep1() {
    document.getElementById('form-default').style.display = 'block';
    document.getElementById('form-queries').style.display = 'none';
  }

  function handleStep1(e) {
    e.preventDefault();
    document.getElementById('form-default').style.display = 'none';
    const qs = document.getElementById('form-queries');
    qs.style.display = 'block';
    qs.style.animation = 'fadeUp 0.4s cubic-bezier(.22,1,.36,1) both';
    // Focus first query input
    setTimeout(() => {
      const first = document.querySelector('#query-list .query-row input');
      if (first) first.focus();
    }, 100);
  }

  function handleStep2() {
    const queries = [...document.querySelectorAll('#query-list .query-row input')]
      .map(i => i.value.trim()).filter(Boolean);

    const btn = document.getElementById('run-btn');
    const btnText = document.getElementById('run-btn-text');
    const spinner = document.getElementById('run-spinner');
    const arrow = document.getElementById('run-arrow');

    btn.disabled = true;
    btnText.textContent = 'Queuing scan...';
    spinner.style.display = 'block';
    arrow.style.display = 'none';
    btn.style.opacity = '0.8';

    setTimeout(() => {
      const bizName = document.getElementById('biz-name').value;
      document.getElementById('form-queries').style.display = 'none';
      document.getElementById('submitted-biz').textContent = '"' + bizName + '"';
      const successEl = document.getElementById('form-success');
      successEl.style.display = 'block';
      successEl.style.animation = 'fadeUp 0.5s cubic-bezier(.22,1,.36,1) both';
    }, 1800);
  }

  // ── Query add/remove ──────────────────────────────────────
  function updateQueryCount() {
    const rows = document.querySelectorAll('#query-list .query-row');
    document.getElementById('query-count').textContent = rows.length + ' / ' + MAX_QUERIES;
    document.getElementById('btn-add-query').disabled = rows.length >= MAX_QUERIES;
    rows.forEach(row => {
      const btn = row.querySelector('.query-remove');
      if (btn) btn.style.display = rows.length > 2 ? 'grid' : 'none';
    });
  }

  function addQuery() {
    const list = document.getElementById('query-list');
    if (list.querySelectorAll('.query-row').length >= MAX_QUERIES) return;
    const row = document.createElement('div');
    row.className = 'query-row';
    row.innerHTML = `
      <input type="text" name="queries[]" placeholder="Enter a search phrase..." style="animation:fadeUp 0.3s cubic-bezier(.22,1,.36,1) both" />
      <button type="button" class="query-remove" onclick="removeQuery(this)" title="Remove">×</button>
    `;
    list.appendChild(row);
    row.querySelector('input').focus();
    updateQueryCount();
  }

  function removeQuery(btn) {
    const list = document.getElementById('query-list');
    if (list.querySelectorAll('.query-row').length <= 2) return;
    btn.closest('.query-row').remove();
    updateQueryCount();
  }

  updateQueryCount();

  // Duplicate ticker for seamless loop
  const ticker = document.getElementById('ticker');
  ticker.innerHTML += ticker.innerHTML;

  // Plan tab switcher for sample report
  function switchPlan(plan) {
    document.querySelectorAll('.plan-tab').forEach(btn => {
      const isMatch = btn.getAttribute('onclick') === `switchPlan('${plan}')`;
      btn.classList.toggle('active', isMatch);
    });
    document.querySelectorAll('.plan-content').forEach(el => {
      el.style.display = el.getAttribute('data-plan') === plan ? 'block' : 'none';
    });
    document.querySelectorAll('.plan-features').forEach(el => {
      el.style.display = el.getAttribute('data-plan') === plan ? 'flex' : 'none';
    });
    const blur = document.getElementById('report-blur');
    if (blur) blur.style.display = plan === 'free' ? 'flex' : 'none';
    const box = document.getElementById('report-preview-box');
    if (box) box.scrollTop = 0;
  }

  // Animate scan preview cycling
  const statuses = [
    { dot: 'active',   text: 'found · rank #2',    cls: 'found' },
    { dot: 'active',   text: 'found · rank #1',    cls: 'found' },
    { dot: 'active',   text: 'mentioned · top 3',  cls: 'found' },
    { dot: 'scanning', text: 'scanning...',         cls: 'scanning' },
    { dot: 'pending',  text: 'queued',              cls: 'pending' },
  ];

  // Cycling animation for the scan preview rows
  const rows = document.querySelectorAll('.scan-row');
  let cyclePhase = 0;

  function cycleScan() {
    const phases = [
      // Phase 0: chatgpt found, claude scanning, rest pending
      [
        { dot: 'active',   text: 'mentioned · rank #2', cls: 'found' },
        { dot: 'scanning', text: 'scanning...',          cls: 'scanning' },
        { dot: 'pending',  text: 'queued',               cls: 'pending' },
        { dot: 'pending',  text: 'queued',               cls: 'pending' },
      ],
      // Phase 1: chatgpt+claude found, perplexity scanning
      [
        { dot: 'active',   text: 'mentioned · rank #2', cls: 'found' },
        { dot: 'active',   text: 'found · rank #1',     cls: 'found' },
        { dot: 'scanning', text: 'scanning...',          cls: 'scanning' },
        { dot: 'pending',  text: 'queued',               cls: 'pending' },
      ],
      // Phase 2: 3 found, gemini scanning
      [
        { dot: 'active',   text: 'mentioned · rank #2', cls: 'found' },
        { dot: 'active',   text: 'found · rank #1',     cls: 'found' },
        { dot: 'active',   text: 'mentioned · top 5',   cls: 'found' },
        { dot: 'scanning', text: 'scanning...',          cls: 'scanning' },
      ],
      // Phase 3: all done
      [
        { dot: 'active',   text: 'mentioned · rank #2', cls: 'found' },
        { dot: 'active',   text: 'found · rank #1',     cls: 'found' },
        { dot: 'active',   text: 'mentioned · top 5',   cls: 'found' },
        { dot: 'active',   text: 'not found',            cls: 'pending' },
      ],
    ];

    const phase = phases[cyclePhase];
    rows.forEach((row, i) => {
      const dotEl = row.querySelector('.scan-dot');
      const statusEl = row.querySelector('.scan-status');
      dotEl.className = 'scan-dot ' + phase[i].dot;
      statusEl.className = 'scan-status ' + phase[i].cls;
      statusEl.textContent = phase[i].text;
    });

    cyclePhase = (cyclePhase + 1) % phases.length;
  }

  setInterval(cycleScan, 2200);

  // Form submission handler
  function handleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('btn-spinner');
    const arrow = document.getElementById('btn-arrow');
    const bizName = document.getElementById('biz-name').value;

    // Loading state
    btn.disabled = true;
    btnText.textContent = 'Queuing scan...';
    spinner.style.display = 'block';
    arrow.style.display = 'none';
    btn.style.opacity = '0.8';

    // Simulate API call
    setTimeout(() => {
      document.getElementById('form-default').style.display = 'none';
      document.getElementById('submitted-biz').textContent = '"' + bizName + '"';
      const successEl = document.getElementById('form-success');
      successEl.style.display = 'block';
      successEl.style.animation = 'fadeUp 0.5s cubic-bezier(.22,1,.36,1) both';
    }, 1800);
  }

  // Bottom CTA form handler
  function handleCtaSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('cta-email').value;
    // Scroll to main form and pre-fill email
    document.getElementById('email').value = email;
    document.getElementById('hero-form').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('biz-name').focus(), 600);
  }

  // Scroll-reveal: fade + rise as elements enter the viewport
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });

  // Groups of selectors with optional per-item stagger
  const revealGroups = [
    { sel: '.ticker-wrap',           stagger: 0 },
    { sel: '.section-label',         stagger: 0 },
    { sel: '.section h2',            stagger: 0.08 },
    { sel: '.section-sub',           stagger: 0.14 },
    { sel: '.steps-grid',            stagger: 0 },
    { sel: '.step',                  stagger: 0.12 },
    { sel: '.report-preview',        stagger: 0 },
    { sel: '.report-point',          stagger: 0.1 },
    { sel: '.pricing-card',          stagger: 0.1 },
    { sel: '.cta-section h2',        stagger: 0 },
    { sel: '.cta-section > .container > p', stagger: 0.08 },
    { sel: '.cta-form',              stagger: 0.14 },
  ];

  revealGroups.forEach(({ sel, stagger }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.closest('.hero')) return; // hero elements use CSS load animations
      const delay = i * stagger;
      el.style.opacity = '0';
      el.style.transform = 'translateY(22px)';
      el.style.transition = `opacity 0.65s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.65s cubic-bezier(.22,1,.36,1) ${delay}s`;
      revealObserver.observe(el);
    });
  });
