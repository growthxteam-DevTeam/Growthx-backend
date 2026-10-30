export type ResourceType = 'article' | 'video';

export interface ResourceSource {
  name: string;
  type: ResourceType;
  feedUrl: string;
}

// The vault only ever shows what these publishers put out, which is how "verified" is enforced:
// adding a source here is the only way new content enters the vault. Every feed was checked to
// respond without a key. General business-news outlets (e.g. Nairametrics, BusinessDay) were left out on
// purpose: they are mostly markets and corporate news, not founder material. YouTube channel feeds carry only the channel's latest 15 videos.
export const RESOURCE_SOURCES: ResourceSource[] = [
  {
    name: 'TechCabal',
    type: 'article',
    feedUrl: 'https://techcabal.com/feed/',
  },
  {
    name: 'Disrupt Africa',
    type: 'article',
    feedUrl: 'https://disruptafrica.com/feed/',
  },
  {
    name: 'TechCrunch',
    type: 'article',
    feedUrl: 'https://techcrunch.com/category/startups/feed/',
  },
  { name: 'Sifted', type: 'article', feedUrl: 'https://sifted.eu/feed' },
  {
    name: 'Y Combinator',
    type: 'article',
    feedUrl: 'https://www.ycombinator.com/blog/rss/',
  },
  {
    name: 'Feld Thoughts',
    type: 'article',
    feedUrl: 'https://www.feld.com/feed',
  },
  {
    name: "Lenny's Newsletter",
    type: 'article',
    feedUrl: 'https://www.lennysnewsletter.com/feed',
  },
  { name: 'SaaStr', type: 'article', feedUrl: 'https://www.saastr.com/feed/' },
  {
    name: 'Andrew Chen',
    type: 'article',
    feedUrl: 'https://andrewchen.com/feed/',
  },
  {
    name: 'Paul Graham',
    type: 'article',
    feedUrl: 'http://www.aaronsw.com/2002/feeds/pgessays.rss',
  },
  {
    name: 'Y Combinator (YouTube)',
    type: 'video',
    feedUrl:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCcefcZRL2oaA_uBNeo5UOWg',
  },
  {
    name: 'Sequoia Capital (YouTube)',
    type: 'video',
    feedUrl:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCWrF0oN6unbXrWsTN7RctTw',
  },
  {
    name: 'a16z (YouTube)',
    type: 'video',
    feedUrl:
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC9cn0TuPq4dnbTY-CBsm8XA',
  },
];

export const RESOURCE_CATEGORIES = [
  'pre-seed',
  'pitch',
  'raise',
  'pricing',
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

// Matched case-insensitively against a story's title and summary. `\b` keeps "raise" from matching
// "raises" (funding-news headlines like "X raises $5M" aren't how-to material).
export const CATEGORY_KEYWORDS: Record<ResourceCategory, RegExp[]> = {
  'pre-seed': [
    /pre-?seed/,
    /\bangel/,
    /\bbootstrap/,
    /\bfirst check/,
    /\bearly[- ]stage/,
    /\bidea stage/,
    /\bmvp\b/,
    /\bgrant/,
    /\baccelerator/,
    /\bincubator/,
  ],
  pitch: [
    /\bpitch/,
    /\bdemo day/,
    /\bstorytelling/,
    /\binvestor (meeting|update|deck)/,
    /\bfounder story/,
  ],
  raise: [
    /\braise\b/,
    /\braising\b/,
    /fundrais/,
    /\bseed (round|funding|stage)/,
    /\bseries [a-c]\b/,
    /\bvaluation/,
    /\bterm sheet/,
    /\bcap table/,
    /\bventure capital/,
    /\binvestors?\b/,
  ],
  pricing: [
    /\bpricing/,
    /\bprice\b/,
    /\bmonetiz/,
    /\bunit economics/,
    /\bsubscription/,
    /\brevenue model/,
  ],
};
