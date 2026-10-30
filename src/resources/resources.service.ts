import { createHash } from 'crypto';

import {
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

import { GetResourcesQueryDto } from './dto/get-resources-query.dto';
import {
  CATEGORY_KEYWORDS,
  RESOURCE_SOURCES,
  type ResourceSource,
  type ResourceType,
} from './resources.sources';

export interface ResourceDto {
  id: string;
  title: string;
  /** Always an http(s) link to the publisher's own page: readers are sent out of our app. */
  url: string;
  source: string;
  type: ResourceType;
  summary: string;
  imageUrl: string | null;
  publishedAt: string | null;
  /** Only for articles whose feed includes the full text. */
  readMinutes: number | null;
}

const FEED_TTL_MS = 30 * 60 * 1000;
const FEED_TIMEOUT_MS = 12000;
const FEED_ATTEMPTS = 2;
const FEED_RETRY_DELAY_MS = 1500;
const DEFAULT_LIMIT = 12;
const SUMMARY_MAX_CHARS = 220;
const WORDS_PER_MINUTE = 200;
// A category needs at least this much evidence: one title hit (3) clears it, one summary hit (1) doesn't.
const MIN_CATEGORY_SCORE = 2;

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// A tag's text is a plain string, or an object (with a `#text` key) when the tag also has attributes.
const text = (node: unknown): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node && typeof node === 'object') {
    return text((node as XmlNode)['#text']);
  }
  return '';
};

const decodeEntities = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const stripHtml = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value: string, max: number) => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max)}…`;
};

// Atom `<link>` is an attribute-only tag (possibly several); RSS `<link>` is plain text.
const linkOf = (node: unknown): string => {
  const links = asArray(node);
  const alternate =
    links.find(
      (link) =>
        typeof link === 'object' &&
        link !== null &&
        ((link as XmlNode)['@_rel'] ?? 'alternate') === 'alternate',
    ) ?? links[0];
  if (typeof alternate === 'object' && alternate !== null) {
    const href = (alternate as XmlNode)['@_href'];
    return typeof href === 'string' ? href : text(alternate);
  }
  return text(alternate);
};

const attributeOf = (node: unknown, name: string): string | undefined => {
  const first = asArray(node)[0];
  if (typeof first !== 'object' || first === null) return undefined;
  const value = (first as XmlNode)[`@_${name}`];
  return typeof value === 'string' ? value : undefined;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'how',
  'what',
  'when',
  'why',
  'who',
  'are',
  'you',
  'your',
  'can',
  'does',
  'from',
  'about',
  'into',
  'that',
  'this',
  'have',
  'has',
  'get',
  'stuck',
]);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One whole-word pattern per meaningful search word. Filler words are dropped and endings are
// trimmed, then allowed back on match, so "fundraising" finds "fundraise" and "leasing" finds "lease"
// but "lease" doesn't match "least".
const searchPatterns = (q?: string): RegExp[] =>
  (q ?? '')
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map((word) => word.replace(/(ings?|ed|es|s|e)$/, ''))
    .filter((stem) => stem.length >= 3)
    .map(
      (stem) =>
        new RegExp(
          `\\b${escapeRegExp(stem)}(?:e|es|ed|ing|ings|s|ion|ions|er|ers|n|ns)?\\b`,
        ),
    );

const toHttpUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

@Injectable()
export class ResourcesService implements OnModuleInit {
  private readonly logger = new Logger(ResourcesService.name);
  private readonly cache = new Map<
    string,
    { at: number; items: ResourceDto[] }
  >();
  private readonly inFlight = new Map<string, Promise<ResourceDto[]>>();

  // Warm the cache in the background so the first applicant to open the vault doesn't wait on every publisher.
  onModuleInit() {
    void Promise.all(RESOURCE_SOURCES.map((source) => this.loadFeed(source)));
  }

  async search({ category, q, limit }: GetResourcesQueryDto) {
    const feeds = await Promise.all(
      RESOURCE_SOURCES.map((source) => this.loadFeed(source)),
    );

    // Every feed failing (e.g. the server has no internet) is an outage, not "no matches": say so
    // instead of returning an empty list, so the app can offer a retry.
    if (feeds.every((items) => items.length === 0)) {
      throw new ServiceUnavailableException(
        'Resources are temporarily unavailable. Please try again in a moment.',
      );
    }

    const patterns = searchPatterns(q);

    const seen = new Set<string>();
    const candidates: { item: ResourceDto; score: number; matched: number }[] =
      [];

    for (const item of feeds.flat()) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      const title = item.title.toLowerCase();
      const summary = item.summary.toLowerCase();
      let score = 0;

      if (category) {
        const categoryScore = CATEGORY_KEYWORDS[category].reduce(
          (sum, pattern) =>
            sum +
            (pattern.test(title) ? 3 : 0) +
            (pattern.test(summary) ? 1 : 0),
          0,
        );
        if (categoryScore < MIN_CATEGORY_SCORE) continue;
        score += categoryScore;
      }

      let matched = 0;
      for (const pattern of patterns) {
        const hit =
          (pattern.test(title) ? 3 : 0) + (pattern.test(summary) ? 1 : 0);
        if (hit > 0) matched += 1;
        score += hit;
      }
      if (patterns.length > 0 && matched === 0) continue;

      candidates.push({ item, score, matched });
    }

    // Natural-language questions rarely match every word, so keep only the best available matches:
    // the items that hit the most of the search words (all of them, when anything does).
    const bestMatch = Math.max(0, ...candidates.map(({ matched }) => matched));

    return candidates
      .filter(({ matched }) => matched === bestMatch)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Date.parse(b.item.publishedAt ?? '') -
            Date.parse(a.item.publishedAt ?? '') ||
          0,
      )
      .slice(0, limit ?? DEFAULT_LIMIT)
      .map(({ item }) => item);
  }

  // One slow or broken publisher must never take the vault down: a failed refresh falls back to the
  // last good copy (or nothing) and is retried on the next request.
  private loadFeed(source: ResourceSource): Promise<ResourceDto[]> {
    const cached = this.cache.get(source.feedUrl);
    if (cached && Date.now() - cached.at < FEED_TTL_MS) {
      return Promise.resolve(cached.items);
    }

    const pending = this.inFlight.get(source.feedUrl);
    if (pending) return pending;

    const request = this.fetchFeedWithRetry(source)
      .then((items) => {
        this.cache.set(source.feedUrl, { at: Date.now(), items });
        return items;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not refresh ${source.name} feed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return cached?.items ?? [];
      })
      .finally(() => this.inFlight.delete(source.feedUrl));

    this.inFlight.set(source.feedUrl, request);
    return request;
  }

  private async fetchFeedWithRetry(
    source: ResourceSource,
  ): Promise<ResourceDto[]> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.fetchFeed(source);
      } catch (error) {
        if (attempt >= FEED_ATTEMPTS) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, FEED_RETRY_DELAY_MS),
        );
      }
    }
  }

  private async fetchFeed(source: ResourceSource): Promise<ResourceDto[]> {
    const response = await fetch(source.feedUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 GrowthX-ResourceVault' },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const doc = parser.parse(await response.text()) as XmlNode;
    const rss = doc.rss as XmlNode | undefined;
    const atom = doc.feed as XmlNode | undefined;
    const entries = asArray<XmlNode>(
      ((rss?.channel as XmlNode | undefined)?.item ?? atom?.entry) as
        XmlNode | XmlNode[] | undefined,
    );

    return entries.flatMap((entry) => {
      const item = this.toResource(entry, source);
      return item ? [item] : [];
    });
  }

  private toResource(
    entry: XmlNode,
    source: ResourceSource,
  ): ResourceDto | null {
    const url = toHttpUrl(linkOf(entry.link));
    const title = stripHtml(text(entry.title));
    if (!url || !title) return null;

    const mediaGroup = entry['media:group'] as XmlNode | undefined;
    const fullText = text(entry['content:encoded']);
    const body =
      fullText ||
      text(entry.description) ||
      text(mediaGroup?.['media:description']) ||
      text(entry.summary) ||
      text(entry.content);

    const published = Date.parse(
      text(entry.pubDate ?? entry.published ?? entry.updated),
    );

    const embeddedImage = /<img[^>]+src=["']([^"']+)["']/i.exec(body)?.[1];
    const imageUrl = toHttpUrl(
      attributeOf(mediaGroup?.['media:thumbnail'], 'url') ??
        attributeOf(entry['media:thumbnail'], 'url') ??
        attributeOf(entry['media:content'], 'url') ??
        attributeOf(entry.enclosure, 'url') ??
        embeddedImage,
    );

    const words = fullText ? stripHtml(fullText).split(' ').length : 0;

    return {
      id: createHash('sha1').update(url).digest('hex').slice(0, 16),
      title,
      url,
      source: source.name,
      type: source.type,
      summary: truncate(stripHtml(body), SUMMARY_MAX_CHARS),
      imageUrl,
      publishedAt: Number.isNaN(published)
        ? null
        : new Date(published).toISOString(),
      readMinutes:
        source.type === 'article' && words > 0
          ? Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
          : null,
    };
  }
}
