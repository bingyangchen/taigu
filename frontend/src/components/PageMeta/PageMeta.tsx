import type { ReactElement } from "react";

import Env from "../../utils/env";

interface Props {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

// Every tag PageMeta renders.
export const PAGE_META_TAGS = [
  { tagName: "title" },
  { tagName: "meta", attribute: "name", value: "description" },
  { tagName: "meta", attribute: "property", value: "og:title" },
  { tagName: "meta", attribute: "property", value: "og:description" },
  { tagName: "meta", attribute: "property", value: "og:url" },
  { tagName: "meta", attribute: "name", value: "twitter:title" },
  { tagName: "meta", attribute: "name", value: "twitter:description" },
  { tagName: "meta", attribute: "name", value: "robots" },
  { tagName: "link", attribute: "rel", value: "canonical" },
] as const;

/**
 * Removes the page metadata that index.html or a prerendered page ships with.
 *
 * React adds the tags of the current page next to existing ones instead of replacing
 * them, so call this before the first render to leave one set in the head.
 */
export function removeStaticPageMeta(): void {
  const selector = PAGE_META_TAGS.map((tag) =>
    "attribute" in tag
      ? `${tag.tagName}[${tag.attribute}="${tag.value}"]`
      : tag.tagName,
  ).join(",");
  for (const element of document.head.querySelectorAll(selector)) element.remove();
}

export default function PageMeta({
  title,
  description,
  canonicalPath,
  noindex,
}: Props): ReactElement {
  const canonicalUrl = canonicalPath ? `${Env.siteOrigin}${canonicalPath}` : null;
  return (
    <>
      <title>{title}</title>
      <meta property="og:title" content={title} />
      <meta name="twitter:title" content={title} />
      {description && (
        <>
          <meta name="description" content={description} />
          <meta property="og:description" content={description} />
          <meta name="twitter:description" content={description} />
        </>
      )}
      {canonicalUrl && (
        <>
          <link rel="canonical" href={canonicalUrl} />
          <meta property="og:url" content={canonicalUrl} />
        </>
      )}
      {noindex && <meta name="robots" content="noindex" />}
    </>
  );
}
