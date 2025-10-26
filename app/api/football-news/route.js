import RSSParser from 'rss-parser';

const parser = new RSSParser({
  customFields: {
    item: ['media:content', 'enclosure', 'content:encoded', 'description'],
  },
});

const FEEDS = [
  'https://www.skysports.com/rss/12040',               // Sky Sports Football
  'https://www.goal.com/en/feeds/news?fmt=rss'         // Goal.com Football
];

// Smarter classification with stricter rules
function classifyStory(title = '') {
  const t = title.toLowerCase();

  if (t.includes("transfer") || t.includes("signing")) return "Transfer Watch";
  if (t.includes("manager") || t.includes("coach")) return "Manager Talk";
  if (t.includes("preview") || t.includes("kick-off") || t.includes("fixtures")) return "Match Preview";

  if (
    (t.includes("wins") || t.includes("draw") || t.includes("beats") || t.includes("loses")) &&
    t.includes("match")
  ) return "Match Recap";

  return "Top Story";
}

// Team detection
function detectTeam(title = '') {
  const teams = [
    "Arsenal", "Manchester United", "Man Utd", "Manchester City", "Man City",
    "Liverpool", "Chelsea", "Tottenham", "Spurs", "Newcastle", "Aston Villa",
    "West Ham", "Leeds", "Leicester", "Everton", "England",
    "Barcelona", "Real Madrid", "PSG", "Inter", "Juventus", "Bayern"
  ];

  return teams.find(team => title.toLowerCase().includes(team.toLowerCase())) || null;
}

// Attempt to get first image
function extractImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.url) return item['media:content'].url;

  const html = item['content:encoded'] || item.description || '';
  const match = html.match(/<img[^>]+src="([^">]+)"/);
  return match ? match[1] : null;
}

// Ensure Sky stories are football-specific
function isFootballStoryFromSky(item) {
  return item.link?.includes("/football/");
}

export async function GET() {
  try {
    const allItems = [];

    for (const url of FEEDS) {
      try {
        const feed = await parser.parseURL(url);
        const isSky = url.includes('skysports');

        feed.items.forEach((item) => {
          const image = extractImage(item);
          const isFootball = isSky ? isFootballStoryFromSky(item) : true;

          if (image && isFootball) {
            allItems.push({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              source: feed.title || "Football Feed",
              image,
              tag: classifyStory(item.title),
              team: detectTeam(item.title)
            });
          }
        });

      } catch (err) {
        console.error(`❌ Error fetching ${url}:`, err.message);
      }
    }

    // Deduplicate
    const deduped = Array.from(new Map(allItems.map(i => [i.title, i])).values());

    return new Response(JSON.stringify(deduped), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("🔥 Football News API Error:", error);
    return new Response(JSON.stringify({ error: "Unable to fetch football news." }), {
      status: 500,
    });
  }
}
