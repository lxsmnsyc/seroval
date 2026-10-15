import { useHead } from '@solidjs/web';

const SITE = 'seroval';

/** Sets the page title and description. */
export default function PageMeta(props: {
  title?: string;
  description: string;
}) {
  useHead(() => [
    {
      tag: 'title',
      props: { children: props.title ? `${props.title} | ${SITE}` : SITE },
    },
    {
      tag: 'meta',
      props: { name: 'description', content: props.description },
    },
  ]);
  return null;
}
