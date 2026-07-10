import { useEffect } from "react";

import Env from "../../utils/env";

interface Props {
  title: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string | null,
): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (content === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href: string | null): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export default function PageMeta({
  title,
  description,
  canonicalPath,
  noindex,
}: Props): null {
  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description ?? null);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description ?? null);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description ?? null);
    const canonicalUrl = canonicalPath ? `${Env.siteOrigin}${canonicalPath}` : null;
    upsertCanonical(canonicalUrl);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("name", "robots", noindex ? "noindex" : null);
  }, [title, description, canonicalPath, noindex]);
  return null;
}
