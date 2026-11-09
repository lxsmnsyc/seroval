import { useLocation } from '@solidjs/router';
import { type HeadTag, type JSX, useHead } from '@solidjs/web';

const SITE = 'seroval';
const IMAGE_ALT =
  "seroval: Serialize what JSON can't. Cyclic references, Dates, Maps, promises, streams and more.";

/** An absolute URL on the site. Link previews ignore relative ones. */
function siteURL(path: string): string {
  return new URL(path, import.meta.env.SITE_URL).href;
}

function meta(key: string, props: Record<string, string>): HeadTag {
  return { tag: 'meta', key, props };
}

/**
 * Sets the page title and description, a canonical link, the Open Graph tags
 * and a large-image Twitter card. Every page shares one image,
 * `public/og.png`, rendered by `pnpm og`. Each tag carries a key, so moving
 * between pages replaces the tags rather than adding to them.
 */
export default function PageMeta(props: { title?: string; description: string }): JSX.Element {
  const location = useLocation();
  useHead(() => {
    const title = props.title ? `${props.title} | ${SITE}` : SITE;
    const url = siteURL(location.pathname);
    return [
      { tag: 'title', key: 'title', props: { children: title } },
      meta('description', { name: 'description', content: props.description }),
      { tag: 'link', key: 'canonical', props: { rel: 'canonical', href: url } },
      meta('og:type', { property: 'og:type', content: 'website' }),
      meta('og:site_name', { property: 'og:site_name', content: SITE }),
      meta('og:title', { property: 'og:title', content: title }),
      meta('og:description', { property: 'og:description', content: props.description }),
      meta('og:url', { property: 'og:url', content: url }),
      meta('og:image', { property: 'og:image', content: siteURL('/og.png') }),
      meta('og:image:width', { property: 'og:image:width', content: '1200' }),
      meta('og:image:height', { property: 'og:image:height', content: '630' }),
      meta('og:image:alt', { property: 'og:image:alt', content: IMAGE_ALT }),
      meta('twitter:card', { name: 'twitter:card', content: 'summary_large_image' }),
    ];
  });
  return null;
}
