(function () {
  const state = {
    region: '',
    category: '',
    page: 1,
    pages: 1,
    articles: []
  };

  const feedEl = document.getElementById('feed');
  const loadMoreWrap = document.getElementById('load-more');
  const loadMoreBtn = document.getElementById('load-more-btn');

  function escapeHtml(str = '') {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function placeholderImg(region) {
    return region === 'kenya'
      ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%232F7A56'/></svg>"
      : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%2314161B'/></svg>";
  }

  function tagRow(article) {
    const bits = [];
    if (article.isBreaking) bits.push('<span class="tag breaking">Breaking</span>');
    bits.push(`<span class="tag region-${article.region}">${article.region === 'kenya' ? 'Kenya' : 'World'}</span>`);
    bits.push(`<span class="tag source">${escapeHtml(article.source)}</span>`);
    return `<div class="tag-row">${bits.join('')}</div>`;
  }

  function renderFeed(reset) {
    if (reset) feedEl.innerHTML = '';

    if (state.articles.length === 0) {
      feedEl.innerHTML = '<div class="empty-state">No stories here yet. Try a different tab, or check back after the next fetch cycle.</div>';
      loadMoreWrap.hidden = true;
      return;
    }

    const startIndex = reset ? 0 : feedEl.querySelectorAll('.lead-card, .story-row').length;

    const frag = document.createDocumentFragment();

    state.articles.slice(startIndex).forEach((article, i) => {
      const globalIndex = startIndex + i;
      const img = article.imageUrl || placeholderImg(article.region);

      if (globalIndex === 0) {
        const el = document.createElement('article');
        el.className = 'lead-card';
        el.dataset.id = article._id;
        el.innerHTML = `
          <img src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">
          <div class="lead-card__body">
            ${tagRow(article)}
            <h2>${escapeHtml(article.title)}</h2>
            <p class="summary-preview">${escapeHtml(article.description || '').slice(0, 140)}${article.description?.length > 140 ? '…' : ''}</p>
          </div>`;
        el.addEventListener('click', () => openArticle(article));
        frag.appendChild(el);
      } else {
        if (globalIndex === 1 || feedEl.querySelector('.story-list') === null) {
          // ensure a story-list wrapper exists for rows after the lead
        }
        const el = document.createElement('div');
        el.className = 'story-row';
        el.dataset.id = article._id;
        el.innerHTML = `
          <div>
            ${tagRow(article)}
            <h3>${escapeHtml(article.title)}</h3>
            <span class="meta">${timeAgo(article.publishedAt)}</span>
          </div>
          <img src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">`;
        el.addEventListener('click', () => openArticle(article));
        frag.appendChild(el);
      }
    });

    // Wrap non-lead rows in a .story-list container for spacing (only on full reset)
    if (reset) {
      const lead = frag.querySelector('.lead-card');
      const rows = [...frag.querySelectorAll('.story-row')];
      feedEl.innerHTML = '';
      if (lead) feedEl.appendChild(lead);
      if (rows.length) {
        const list = document.createElement('div');
        list.className = 'story-list';
        rows.forEach((r) => list.appendChild(r));
        feedEl.appendChild(list);
      }
    } else {
      const list = feedEl.querySelector('.story-list') || (() => {
        const l = document.createElement('div');
        l.className = 'story-list';
        feedEl.appendChild(l);
        return l;
      })();
      [...frag.querySelectorAll('.story-row')].forEach((r) => list.appendChild(r));
      const lead = frag.querySelector('.lead-card');
      if (lead) feedEl.appendChild(lead); // edge case, shouldn't normally happen on page>1
    }

    loadMoreWrap.hidden = state.page >= state.pages;
  }

  async function loadNews(reset) {
    if (reset) {
      state.page = 1;
      feedEl.innerHTML = '<div class="empty-state">Loading the newsroom&hellip;</div>';
    }

    const params = new URLSearchParams();
    if (state.region) params.set('region', state.region);
    if (state.category) params.set('category', state.category);
    params.set('page', state.page);
    params.set('limit', 12);

    try {
      const res = await fetch(`/api/news?${params.toString()}`);
      const data = await res.json();

      state.pages = data.pages || 1;
      state.articles = reset ? data.articles : [...state.articles, ...data.articles];

      renderFeed(reset);
    } catch (err) {
      feedEl.innerHTML = '<div class="empty-state">Couldn\'t reach the newsroom. Check your connection and pull to refresh.</div>';
    }
  }

  async function loadTicker() {
    const track = document.getElementById('ticker-track');
    try {
      const res = await fetch('/api/news/breaking');
      const data = await res.json();
      const items = data.articles || [];
      if (items.length === 0) {
        track.innerHTML = '<span><span class="label">WIRE</span>No breaking alerts right now.</span>';
        return;
      }
      const html = items.map((a) => `<span><span class="label">${a.region === 'kenya' ? 'KE' : 'WORLD'}</span>${escapeHtml(a.title)}</span>`).join('');
      track.innerHTML = html + html;
    } catch (err) {
      track.innerHTML = '<span><span class="label">WIRE</span>Headlines unavailable right now.</span>';
    }
  }

  function renderAiSummary(article) {
    if (!article.aiSummary) {
      return `<p class="original-desc">${escapeHtml(article.description || 'No summary available yet for this story.')}</p>`;
    }
    const lines = article.aiSummary.split('\n').map((l) => l.trim()).filter(Boolean);
    const bullets = lines.filter((l) => l.startsWith('-')).map((l) => l.replace(/^- ?/, ''));
    const whyLine = lines.find((l) => /^WHY:/i.test(l));

    return `
      <div class="ai-box">
        <span class="ai-box__label">AI digest</span>
        <ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        ${whyLine ? `<p class="why">${escapeHtml(whyLine.replace(/^WHY:\s*/i, ''))}</p>` : ''}
      </div>
      <p class="original-desc">${escapeHtml(article.description || '')}</p>
    `;
  }

  function openArticle(article) {
    const content = document.getElementById('article-content');
    const img = article.imageUrl || placeholderImg(article.region);

    content.innerHTML = `
      <img class="sheet__img" src="${img}" alt="" onerror="this.style.display='none'">
      <div class="sheet__body">
        ${tagRow(article)}
        <h2>${escapeHtml(article.title)}</h2>
        ${renderAiSummary(article)}
        <a class="sheet__read-original" href="${article.link}" target="_blank" rel="noopener noreferrer">
          Read full article at ${escapeHtml(article.source)} ↗
        </a>
      </div>
    `;

    document.getElementById('article-backdrop').classList.add('open');
    document.getElementById('article-sheet').classList.add('open');
  }

  function closeArticle() {
    document.getElementById('article-backdrop').classList.remove('open');
    document.getElementById('article-sheet').classList.remove('open');
  }

  document.getElementById('article-close').addEventListener('click', closeArticle);
  document.getElementById('article-backdrop').addEventListener('click', closeArticle);

  document.querySelectorAll('.region-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.region-toggle button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.region = btn.dataset.region;
      loadNews(true);
    });
  });

  document.querySelectorAll('#category-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#category-tabs button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.category = btn.dataset.category;
      loadNews(true);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    state.page += 1;
    loadNews(false);
  });

  // Deep-link support: /app.html?article=<id> (used by push notification clicks)
  async function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    if (!articleId) return;
    try {
      const res = await fetch(`/api/news/${articleId}`);
      if (!res.ok) return;
      const data = await res.json();
      openArticle(data.article);
    } catch (err) {
      // silently ignore - not worth blocking the feed load over a bad deep link
    }
  }

  window.CymorToast = function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  };

  loadNews(true);
  loadTicker();
  checkDeepLink();
  setInterval(loadTicker, 60000);
})();
