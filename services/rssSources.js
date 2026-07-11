// Kenyan news sources, pulled via RSS. Feed URLs occasionally move when a
// publisher redesigns their site - if one starts returning 0 items, check
// the outlet's site footer for "RSS" or try <domain>/feed as a fallback.
//
// Each source can list multiple feeds mapped to categories. If a publisher
// only exposes one general feed, everything from it is tagged "top".

module.exports = [
  {
    source: 'Daily Nation',
    feeds: [
      { url: 'https://nation.africa/kenya/rss', category: 'top' }
    ]
  },
  {
    source: 'The Standard',
    feeds: [
      { url: 'https://www.standardmedia.co.ke/rss/headlines.php', category: 'top' },
      { url: 'https://www.standardmedia.co.ke/rss/politics.php', category: 'politics' },
      { url: 'https://www.standardmedia.co.ke/rss/business.php', category: 'business' },
      { url: 'https://www.standardmedia.co.ke/rss/sports.php', category: 'sports' }
    ]
  },
  {
    source: 'Citizen Digital',
    feeds: [
      { url: 'https://www.citizen.digital/rss', category: 'top' }
    ]
  },
  {
    source: 'The Star',
    feeds: [
      { url: 'https://www.the-star.co.ke/rss', category: 'top' }
    ]
  },
  {
    source: 'Tuko',
    feeds: [
      { url: 'https://www.tuko.co.ke/rss', category: 'top' }
    ]
  },
  {
    source: 'Capital FM Kenya',
    feeds: [
      { url: 'https://www.capitalfm.co.ke/news/feed/', category: 'top' }
    ]
  }
];
