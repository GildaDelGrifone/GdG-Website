import site from '../data/site.json';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Json = Record<string, unknown>;

// schema.org vuole HH:MM, quindi la mezzanotte "24:00" diventa 23:59.
const time = (t: string) => (t === '24:00' ? '23:59' : t);

export function siteSchema(origin: string): Json[] {
  const [street, locality] = site.address.split(',').map((s) => s.trim());
  const orgId = `${origin}/#org`;

  return [
    {
      '@type': ['Organization', 'LocalBusiness'],
      '@id': orgId,
      name: site.name,
      url: origin,
      logo: `${origin}/logo.png`,
      image: `${origin}/logo.png`,
      email: site.email,
      telephone: site.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: street,
        addressLocality: locality,
        addressCountry: 'IT',
      },
      openingHoursSpecification: site.hours
        .filter((h) => !h.closed && h.open && h.close)
        .map((h) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: DAYS[h.day],
          opens: time(h.open!),
          closes: time(h.close!),
        })),
      sameAs: [site.telegramUrl],
    },
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: origin,
      name: site.name,
      inLanguage: 'it-IT',
      publisher: { '@id': orgId },
    },
  ];
}

export function articleSchema(origin: string, a: { title: string; date: Date; url: string; image?: string }): Json {
  return {
    '@type': 'Article',
    headline: a.title,
    datePublished: a.date.toISOString(),
    dateModified: a.date.toISOString(),
    ...(a.image && { image: new URL(a.image, origin).href }),
    author: { '@id': `${origin}/#org` },
    publisher: { '@id': `${origin}/#org` },
    mainEntityOfPage: a.url,
    inLanguage: 'it-IT',
  };
}

// Il JSON va dentro un <script>: neutralizza "<" per evitare di chiudere il tag.
export function toJsonLd(nodes: Json[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}

export function breadcrumbSchema(origin: string, items: { name: string; path: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.path, origin).href,
    })),
  };
}
