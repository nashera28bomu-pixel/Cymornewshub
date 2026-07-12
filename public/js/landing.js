(function () {
  const dateEl = document.getElementById('dateline-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  async function loadTicker() {
    const track = document.getElementById('ticker-track');
    if (!track) return;

    try {
      const res = await fetch('/api/news/breaking');
      const data = await res.json();
      const items = data.articles || [];

      if (items.length === 0) {
        track.innerHTML = '<span><span class="label">WIRE</span>No breaking alerts right now — the newsroom is calm.</span>';
        return;
      }

      // Duplicate the list so the CSS marquee (translateX -50%) loops seamlessly.
      const html = items
        .map((a) => `<span><span class="label">${a.region === 'kenya' ? 'KE' : 'WORLD'}</span>${escapeHtml(a.title)}</span>`)
        .join('');
      track.innerHTML = html + html;
    } catch (err) {
      track.innerHTML = '<span><span class="label">WIRE</span>Headlines will appear once the server has fetched the news.</span>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadTicker();
})();
