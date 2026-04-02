// Vercel serverless function: GET /api/menu
// Attempts to fetch live menu data from DoorDash via JSON-LD structured data.
// Falls back to hardcoded menu if DoorDash is unreachable (Cloudflare, etc.).

const DOORDASH_URL = 'https://www.doordash.com/store/revamped-coffee-co-belgrade-24566711/';

const FALLBACK_MENU = [
  {
    name: "Major Arcana",
    subtitle: "Specialty Coffee",
    items: [
      { name: "The Magician", desc: "Cinnamon, white chocolate, maple", price: "7.25" },
      { name: "Lilith", desc: "Spicy white chocolate, whip cream", price: "7.00" },
      { name: "Temperance", desc: "White chocolate, blueberry", price: "7.25" },
      { name: "The Lovers", desc: "Dark chocolate, cherry", price: "7.25" },
      { name: "Death", desc: "Mexican mocha", price: "6.85" },
      { name: "High Priestess", desc: "Tart raspberry, dark chocolate", price: "7.25" },
    ]
  },
  {
    name: "Potions",
    subtitle: "Traditional Coffee",
    items: [
      { name: "Black Widow", desc: "Classic latte with whole milk", price: "6.25" },
      { name: "Swamp Water", desc: "Classic Americano — try it sparkling", price: "5.75" },
      { name: "Witch's Brew", desc: "Signature iced coffee", price: "4.75" },
      { name: "Dark & Stormy", desc: "Blend of creamy foam and espresso", price: "6.25" },
      { name: "Scaramel Machiatto", desc: "Vanilla, whole milk, caramel layers", price: "7.95" },
      { name: "Flat White", desc: "Three shots of espresso with whole milk", price: "7.95" },
    ]
  },
  {
    name: "Mystical Serums",
    subtitle: "Spring & Summer Specials",
    items: [
      { name: "Poison Apple", desc: "Apple, cinnamon caramel, oat milk, red cold foam", price: "8.80" },
      { name: "Gaia", desc: "Honeycrisp apple, lavender, white espresso", price: "8.30" },
      { name: "Purple People Eater", desc: "Violet, dark chocolate and espresso", price: "7.95" },
      { name: "Rose Red", desc: "Lemoncello water, rose syrup, espresso", price: "6.95" },
      { name: "Butterscotch Latte", desc: "Butterscotch, espresso, caramel drizzle", price: "7.95" },
      { name: "Pumpkin Pie Latte", desc: "Housemade pumpkin puree, cinnamon", price: "7.95" },
    ]
  },
  {
    name: "Milk Tea Spell Book",
    subtitle: "With Bursting Pearls",
    items: [
      { name: "Taro Bubble Tea", desc: "Creamy taro with strawberry pearls", price: "7.50" },
      { name: "Butterfly Pea", desc: "Coconut milk & rose pearls", price: "7.25" },
      { name: "Matcha Bubble Tea", desc: "Traditional matcha with peach pearls", price: "7.75" },
      { name: "Watermelon", desc: "Summer refresher with kiwi pearls", price: "7.50" },
      { name: "Brown Sugar", desc: "Brown sugar milk tea, chocolate pearls", price: "7.50" },
      { name: "Honeydew", desc: "Creamy honeydew with rainbow pearls", price: "7.50" },
    ]
  },
  {
    name: "Ghoulish Delights",
    subtitle: "Food & Pastries",
    items: [
      { name: "Bacon Breakfast Burrito", desc: "Bacon, egg, peppers, potatoes, salsa verde", price: "8.50" },
      { name: "Chorizo Breakfast Burrito", desc: "Chorizo, egg, peppers, onion, cheese", price: "8.75" },
      { name: "Sausage Egg & Cheese Bagel", desc: "Local sausage, cheddar on everything bagel", price: "7.95" },
      { name: "Ham & Cheese Sliders", desc: "Hawaiian rolls, smoked honey ham, melted jack", price: "6.75" },
      { name: "Cookie Butter Stuffed Cookie", desc: "6.4oz with biscoff cookies, 5g protein", price: "6.50" },
      { name: "Pesto Sun-Dried Tomato Bagel", desc: "Pesto basil, sun-dried tomato, monterey jack", price: "7.25" },
    ]
  },
  {
    name: "Herbal Elixirs",
    subtitle: "Teas & Tea Lattes",
    items: [
      { name: "Chai Tea Latte", desc: "Spicy chai and whole milk", price: "6.75" },
      { name: "London Fog", desc: "Earl grey, vanilla & whole milk", price: "6.25" },
      { name: "Campfire Tea", desc: "Lapsong Souchong, smokey pinewood, cedar tips", price: "4.25" },
      { name: "Iced Blackberry Chai", desc: "Blackberry puree, chai & oat milk", price: "6.95" },
      { name: "Matcha Tea Latte", desc: "Traditional matcha", price: "6.75" },
      { name: "Peach Fog", desc: "Earl grey infused with peach and vanilla", price: "6.25" },
    ]
  }
];

function parseJsonLd(html) {
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      const nodes = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const node of nodes) {
        const type = node['@type'];
        if (type === 'Restaurant' || type === 'FoodEstablishment') {
          const menu = node.hasMenu;
          if (!menu) continue;
          const sections = menu.hasMenuSection || [];
          const categories = sections.map(section => ({
            name: section.name || 'Menu',
            subtitle: section.description || '',
            items: (section.hasMenuItem || []).map(item => ({
              name: item.name || '',
              desc: item.description || '',
              price: item.offers?.price
                ? String(parseFloat(item.offers.price).toFixed(2))
                : '',
            })).filter(i => i.name)
          })).filter(c => c.items.length > 0);
          if (categories.length > 0) return categories;
        }
      }
    } catch (_) {}
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(DOORDASH_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();

    // Check for Cloudflare challenge page
    if (html.includes('cf-browser-verification') || html.includes('_cf_chl_opt') || html.includes('Just a moment')) {
      throw new Error('Cloudflare challenge');
    }

    const categories = parseJsonLd(html);
    if (!categories) throw new Error('No parseable menu data in JSON-LD');

    return res.status(200).json({ categories, source: 'live' });
  } catch (err) {
    return res.status(200).json({ categories: FALLBACK_MENU, source: 'fallback', reason: err.message });
  }
};
