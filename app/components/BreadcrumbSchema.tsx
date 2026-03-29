"use client";

export default function BreadcrumbSchema({ name, path }: { name: string; path: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://xanlens.com/" },
            { "@type": "ListItem", position: 2, name, item: `https://xanlens.com${path}` },
          ],
        }),
      }}
    />
  );
}
