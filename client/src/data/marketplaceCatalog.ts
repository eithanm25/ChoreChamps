/**
 * Static "live search" simulation catalog for the parent reward picker.
 * Standing in for a real marketplace/affiliate API — matched by keyword as
 * the parent types, so no one ever needs to paste a raw product URL by hand.
 * Images are neutral placeholders; affiliateUrl points at our own mock
 * marketplace route (client-side only) tagged with a tracking param, in the
 * same shape a real affiliate link would take.
 */
export interface MarketplaceCatalogItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateUrl: string;
  keywords: string[];
  /** Shown in the default 4-item carousel when the search box is empty. */
  featured?: boolean;
}

function placeholder(label: string): string {
  return `https://placehold.co/300x300/6366f1/ffffff?text=${encodeURIComponent(label)}&font=roboto`;
}

function mockAffiliateUrl(slug: string): string {
  return `https://marketplace.chorechamps.app/products/${slug}?ref=chorechamps-app`;
}

export const MARKETPLACE_CATALOG: MarketplaceCatalogItem[] = [
  {
    id: 'lego-city-police',
    title: 'לגו סיטי - תחנת משטרה',
    description: 'סט לגו סיטי מקורי הכולל תחנת משטרה, ניידת משטרה ודמויות שוטרים.',
    imageUrl: placeholder('LEGO City'),
    affiliateUrl: mockAffiliateUrl('lego-city-police-station'),
    keywords: ['לגו', 'משטרה', 'lego', 'סיטי'],
    featured: true,
  },
  {
    id: 'lego-technic-car',
    title: 'לגו טכניק - מכונית מירוץ',
    description: 'סט לגו טכניק מתקדם לבניית מכונית מירוץ עם מנגנון היגוי אמיתי.',
    imageUrl: placeholder('LEGO Technic'),
    affiliateUrl: mockAffiliateUrl('lego-technic-race-car'),
    keywords: ['לגו', 'מכונית', 'טכניק', 'lego'],
  },
  {
    id: 'lego-friends-house',
    title: 'לגו פרנדס - בית החברות',
    description: 'סט לגו פרנדס עם בית מפורט, ריהוט ודמויות.',
    imageUrl: placeholder('LEGO Friends'),
    affiliateUrl: mockAffiliateUrl('lego-friends-house'),
    keywords: ['לגו', 'בית', 'פרנדס', 'lego', 'בנות'],
  },
  {
    id: 'soccer-ball-pro',
    title: 'כדורגל מקצועי מידה 5',
    description: 'כדור כדורגל איכותי, עמיד למשחקים בחוץ ובמגרש.',
    imageUrl: placeholder('Soccer Ball'),
    affiliateUrl: mockAffiliateUrl('soccer-ball-size-5'),
    keywords: ['כדור', 'כדורגל', 'ספורט', 'football'],
    featured: true,
  },
  {
    id: 'basketball-street',
    title: 'כדורסל סטריט מקצועי',
    description: 'כדורסל בגודל תקני, מתאים למגרשים חיצוניים.',
    imageUrl: placeholder('Basketball'),
    affiliateUrl: mockAffiliateUrl('basketball-street-pro'),
    keywords: ['כדור', 'כדורסל', 'ספורט', 'basketball'],
  },
  {
    id: 'cinema-city-voucher',
    title: 'שובר זוגי לקולנוע - סינמה סיטי',
    description: 'שובר לצפייה בסרט לשני מבוגרים בכל סניפי סינמה סיטי בארץ.',
    imageUrl: placeholder('Cinema City'),
    affiliateUrl: mockAffiliateUrl('cinema-city-double-voucher'),
    keywords: ['סרט', 'קולנוע', 'סינמה', 'cinema'],
    featured: true,
  },
  {
    id: 'cinema-popcorn-combo',
    title: 'שובר סרט + פופקורן ושתייה',
    description: 'כרטיס לסרט הבחירה כולל קומבו פופקורן גדול ושתייה.',
    imageUrl: placeholder('Movie Combo'),
    affiliateUrl: mockAffiliateUrl('cinema-popcorn-combo'),
    keywords: ['סרט', 'קולנוע', 'פופקורן', 'movie'],
  },
  {
    id: 'wireless-headphones-kids',
    title: 'אוזניות אלחוטיות לילדים',
    description: 'אוזניות בלוטות׳ צבעוניות עם הגבלת עוצמת קול בטוחה לילדים.',
    imageUrl: placeholder('Headphones'),
    affiliateUrl: mockAffiliateUrl('wireless-headphones-kids'),
    keywords: ['אוזניות', 'בלוטות', 'headphones', 'מוזיקה'],
    featured: true,
  },
  {
    id: 'board-game-catan',
    title: 'משחק קופסה - קטאן',
    description: 'משחק אסטרטגיה משפחתי פופולרי לכל הגילאים.',
    imageUrl: placeholder('Board Game'),
    affiliateUrl: mockAffiliateUrl('catan-board-game'),
    keywords: ['משחק', 'קופסה', 'קטאן', 'לוח'],
  },
  {
    id: 'art-set-deluxe',
    title: 'מארז ציור וצבעים דלוקס',
    description: 'סט ציור מקצועי הכולל צבעי מים, עפרונות צבעוניים ובד קנבס.',
    imageUrl: placeholder('Art Set'),
    affiliateUrl: mockAffiliateUrl('art-set-deluxe'),
    keywords: ['ציור', 'צבעים', 'אומנות', 'art'],
  },
  {
    id: 'puzzle-1000',
    title: 'פאזל 1000 חלקים - נופי עולם',
    description: 'פאזל מאתגר ואיכותי עם תמונת נוף מרהיבה.',
    imageUrl: placeholder('Puzzle'),
    affiliateUrl: mockAffiliateUrl('puzzle-1000-world-views'),
    keywords: ['פאזל', 'puzzle'],
  },
  {
    id: 'bicycle-kids-20',
    title: 'אופני ילדים 20 אינץ׳',
    description: 'אופניים עמידים ובטוחים לילדים, כולל פעמון וסלסלה.',
    imageUrl: placeholder('Bicycle'),
    affiliateUrl: mockAffiliateUrl('kids-bicycle-20-inch'),
    keywords: ['אופניים', 'אופני', 'bike'],
  },
  {
    id: 'doll-fashion',
    title: 'בובת אופנה עם מלתחה',
    description: 'בובה מפורטת הכוללת סט בגדים ואביזרים להחלפה.',
    imageUrl: placeholder('Fashion Doll'),
    affiliateUrl: mockAffiliateUrl('fashion-doll-wardrobe'),
    keywords: ['בובה', 'doll', 'בנות'],
  },
  {
    id: 'gift-card-toystore',
    title: 'שובר מתנה לחנות צעצועים - 100₪',
    description: 'שובר מתנה גמיש למימוש בכל סניפי רשת חנויות הצעצועים.',
    imageUrl: placeholder('Gift Card'),
    affiliateUrl: mockAffiliateUrl('toystore-gift-card-100'),
    keywords: ['שובר', 'מתנה', 'gift'],
  },
];

/** Featured items shown as the default carousel when the search box is empty. */
export function getFeaturedCatalogItems(): MarketplaceCatalogItem[] {
  const featured = MARKETPLACE_CATALOG.filter((item) => item.featured);
  return featured.length > 0 ? featured.slice(0, 4) : MARKETPLACE_CATALOG.slice(0, 4);
}

/** Keyword search across title + keyword tags — simulates a live marketplace search API. */
export function searchCatalogItems(query: string): MarketplaceCatalogItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return getFeaturedCatalogItems();
  }
  const q = trimmed.toLowerCase();
  return MARKETPLACE_CATALOG.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(q) || q.includes(keyword.toLowerCase())),
  );
}
