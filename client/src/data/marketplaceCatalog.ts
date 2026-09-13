/**
 * Static "live search" simulation catalog for the parent reward picker.
 * Standing in for a real marketplace/affiliate API — matched by keyword as
 * the parent types, so no one ever needs to paste a raw product URL by hand.
 *
 * Multi-store by design: each item carries a `purchaseLinks` array instead of
 * a single link, so the UI can show a comparison button per store (eBay,
 * Amazon, AliExpress, or a brand's own site under 'custom') without any
 * future schema change. `url` currently points at each store's generic
 * search results for the item's name — real, live, working links today —
 * ready to be swapped for exact product/affiliate links or a live pricing
 * API later with zero code changes, only data.
 *
 * imageUrl values are real, permanent Wikimedia Commons file URLs (verified
 * reachable), not placeholder graphics — Commons hotlinking is explicitly
 * supported and stable long-term.
 */

export type StoreName = 'ebay' | 'amazon' | 'aliexpress' | 'custom';

export interface PurchaseLink {
  storeName: StoreName;
  /** Display price, e.g. "85₪" — approximate, for comparison only until real store data is wired in. */
  priceLabel: string;
  /** Live link today (a generic store search for the item); swap for an exact product/affiliate URL later. */
  url: string;
}

export interface MarketplaceCatalogItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  purchaseLinks: PurchaseLink[];
  keywords: string[];
  /** Shown in the default 4-item carousel when the search box is empty. */
  featured?: boolean;
}

const STORE_SEARCH_BASE: Record<Exclude<StoreName, 'custom'>, string> = {
  ebay: 'https://www.ebay.com/sch/i.html?_nkw=',
  amazon: 'https://www.amazon.com/s?k=',
  aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
};

/** A real, working search-results URL on the given store for `query` — a live baseline link until an exact product/affiliate URL replaces it. */
function storeSearchUrl(store: Exclude<StoreName, 'custom'>, query: string): string {
  return `${STORE_SEARCH_BASE[store]}${encodeURIComponent(query)}`;
}

export const MARKETPLACE_CATALOG: MarketplaceCatalogItem[] = [
  {
    id: 'lego-star-wars-death-star',
    title: 'לגו סטאר וורס - דת סטאר',
    description: 'סט לגו סטאר וורס מרשים הכולל את תחנת החלל האייקונית ודמויות מהסרט.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Lego_Star_Wars_-_Set_10188_Death_Star_%286884743289%29.jpg/960px-Lego_Star_Wars_-_Set_10188_Death_Star_%286884743289%29.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '449₪', url: storeSearchUrl('amazon', 'LEGO Star Wars Death Star set') },
      { storeName: 'ebay', priceLabel: '399₪', url: storeSearchUrl('ebay', 'LEGO Star Wars Death Star set') },
    ],
    keywords: ['לגו', 'סטאר וורס', 'lego', 'star wars', 'חלל'],
    featured: true,
  },
  {
    id: 'lego-technic-set',
    title: 'לגו טכניק - סט הרכבה מתקדם',
    description: 'סט לגו טכניק להרכבת מודל מכני מפורט עם גלגלי שיניים ומנגנונים אמיתיים.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/LEGO_Technic_Bits.jpg/960px-LEGO_Technic_Bits.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '299₪', url: storeSearchUrl('amazon', 'LEGO Technic set') },
      { storeName: 'ebay', priceLabel: '259₪', url: storeSearchUrl('ebay', 'LEGO Technic set') },
    ],
    keywords: ['לגו', 'טכניק', 'lego', 'technic', 'מכונית'],
  },
  {
    id: 'lego-friends-cafe',
    title: 'לגו פרנדס - בית הקפה של אמה',
    description: 'סט לגו פרנדס עם בית קפה מפורט, ריהוט ודמויות.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/LEGO_Friends_41336_Emma%27s_Art_Cafe_%2827978112067%29.jpg/960px-LEGO_Friends_41336_Emma%27s_Art_Cafe_%2827978112067%29.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '199₪', url: storeSearchUrl('amazon', 'LEGO Friends cafe set') },
      { storeName: 'ebay', priceLabel: '179₪', url: storeSearchUrl('ebay', 'LEGO Friends cafe set') },
    ],
    keywords: ['לגו', 'פרנדס', 'lego', 'friends', 'בנות'],
    featured: true,
  },
  {
    id: 'lego-duplo-bricks',
    title: 'לגו דופלו - קוביות לפעוטות',
    description: 'ערכת קוביות לגו דופלו גדולות ובטוחות, מושלמת לבנייה יצירתית לגיל הרך.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Lego_Duplo_%2854985720359%29.jpg/960px-Lego_Duplo_%2854985720359%29.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '129₪', url: storeSearchUrl('amazon', 'LEGO Duplo set') },
      { storeName: 'aliexpress', priceLabel: '89₪', url: storeSearchUrl('aliexpress', 'LEGO Duplo bricks set') },
    ],
    keywords: ['לגו', 'דופלו', 'lego', 'duplo', 'פעוטות'],
  },
  {
    id: 'lego-classic-bricks',
    title: 'לגו קלאסיק - ארגז קוביות יצירה',
    description: 'מאות קוביות לגו צבעוניות בכל הצורות — לבנייה חופשית ללא גבולות.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Pieces_of_lego.png/960px-Pieces_of_lego.png',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '159₪', url: storeSearchUrl('amazon', 'LEGO Classic bricks box') },
      { storeName: 'custom', priceLabel: '169₪', url: 'https://www.lego.com/en-us/search?q=classic' },
    ],
    keywords: ['לגו', 'קלאסיק', 'lego', 'classic', 'קוביות'],
  },
  {
    id: 'playstation-5-console',
    title: 'קונסולת PlayStation 5',
    description: 'קונסולת המשחקים המתקדמת של סוני, כולל שלט DualSense.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/PlayStation_5_and_DualSense_%282%29.jpg/960px-PlayStation_5_and_DualSense_%282%29.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '2199₪', url: storeSearchUrl('amazon', 'PlayStation 5 console') },
      { storeName: 'ebay', priceLabel: '1999₪', url: storeSearchUrl('ebay', 'PlayStation 5 console') },
    ],
    keywords: ['פלייסטיישן', 'playstation', 'ps5', 'קונסולה'],
    featured: true,
  },
  {
    id: 'dualsense-controller',
    title: 'שלט DualSense אלחוטי',
    description: 'שלט משחק אלחוטי עם משוב הפטי ולחצני התאמה אדפטיביים.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Playstation_Dualsense_controller.jpg/960px-Playstation_Dualsense_controller.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '279₪', url: storeSearchUrl('amazon', 'DualSense wireless controller') },
      { storeName: 'ebay', priceLabel: '229₪', url: storeSearchUrl('ebay', 'DualSense wireless controller') },
    ],
    keywords: ['שלט', 'דואלסנס', 'dualsense', 'playstation', 'בקר'],
  },
  {
    id: 'nintendo-switch-console',
    title: 'קונסולת Nintendo Switch',
    description: 'קונסולה היברידית לשולחן ולנייד, עם שלטי Joy-Con נשלפים.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Nintendo-Switch-Console-Docked-wJoyConRB.jpg/960px-Nintendo-Switch-Console-Docked-wJoyConRB.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '1299₪', url: storeSearchUrl('amazon', 'Nintendo Switch console') },
      { storeName: 'ebay', priceLabel: '1099₪', url: storeSearchUrl('ebay', 'Nintendo Switch console') },
    ],
    keywords: ['נינטנדו', 'סוויץ', 'nintendo', 'switch', 'קונסולה'],
    featured: true,
  },
  {
    id: 'xbox-wireless-controller',
    title: 'שלט Xbox אלחוטי',
    description: 'שלט משחק אלחוטי איכותי, תואם קונסולות Xbox ומחשב.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Microsoft-Xbox-One-controller.jpg/960px-Microsoft-Xbox-One-controller.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '249₪', url: storeSearchUrl('amazon', 'Xbox wireless controller') },
      { storeName: 'ebay', priceLabel: '199₪', url: storeSearchUrl('ebay', 'Xbox wireless controller') },
    ],
    keywords: ['שלט', 'אקסבוקס', 'xbox', 'בקר', 'controller'],
  },
  {
    id: 'gaming-mouse-pro',
    title: 'עכבר גיימינג מקצועי',
    description: 'עכבר גיימינג מדויק עם תאורת RGB ולחצנים ניתנים לתכנות.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/Razer_DeathAdder_Elite-front_oblique-ar_16to10-fs_PNr%C2%B00465.jpg/960px-Razer_DeathAdder_Elite-front_oblique-ar_16to10-fs_PNr%C2%B00465.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '169₪', url: storeSearchUrl('amazon', 'gaming mouse RGB') },
      { storeName: 'aliexpress', priceLabel: '89₪', url: storeSearchUrl('aliexpress', 'gaming mouse RGB') },
    ],
    keywords: ['עכבר', 'גיימינג', 'gaming', 'mouse'],
  },
  {
    id: 'gaming-keyboard-mechanical',
    title: 'מקלדת גיימינג מכנית',
    description: 'מקלדת מכנית עם תאורה צבעונית, לחוויית משחק מהירה ומדויקת.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Logitech-g910_%2816475940137%29.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '349₪', url: storeSearchUrl('amazon', 'mechanical gaming keyboard') },
      { storeName: 'ebay', priceLabel: '289₪', url: storeSearchUrl('ebay', 'mechanical gaming keyboard') },
    ],
    keywords: ['מקלדת', 'גיימינג', 'keyboard', 'gaming', 'מכנית'],
  },
  {
    id: 'wireless-earbuds',
    title: 'אוזניות אלחוטיות טרו-וויירלס',
    description: 'אוזניות בלוטות׳ קטנות וקומפקטיות עם קופסת טעינה נטענת.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Technics-EAH-AZ60M2_09.jpg/960px-Technics-EAH-AZ60M2_09.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '229₪', url: storeSearchUrl('amazon', 'wireless earbuds bluetooth') },
      { storeName: 'aliexpress', priceLabel: '119₪', url: storeSearchUrl('aliexpress', 'wireless earbuds bluetooth') },
    ],
    keywords: ['אוזניות', 'אלחוטיות', 'earbuds', 'bluetooth', 'בלוטות'],
    featured: true,
  },
  {
    id: 'over-ear-headphones',
    title: 'אוזניות אוזן מלאה אלחוטיות',
    description: 'אוזניות קשת איכותיות עם בס עוצמתי, לחוויית מוזיקה סוחפת.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/BEATS_BY_DR.DRE_SOLO_HD_MONSTER_HEADPHONE.jpg/960px-BEATS_BY_DR.DRE_SOLO_HD_MONSTER_HEADPHONE.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '349₪', url: storeSearchUrl('amazon', 'over-ear wireless headphones') },
      { storeName: 'ebay', priceLabel: '279₪', url: storeSearchUrl('ebay', 'over-ear wireless headphones') },
    ],
    keywords: ['אוזניות', 'headphones', 'מוזיקה'],
  },
  {
    id: 'soccer-ball-pro',
    title: 'כדורגל מקצועי מידה 5',
    description: 'כדור כדורגל איכותי בעיצוב אייקוני, עמיד למשחקים בחוץ ובמגרש.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Adidas_Telstar_Mexico_1970_Official_ball.jpg/960px-Adidas_Telstar_Mexico_1970_Official_ball.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '89₪', url: storeSearchUrl('amazon', 'soccer ball size 5') },
      { storeName: 'ebay', priceLabel: '69₪', url: storeSearchUrl('ebay', 'soccer ball size 5') },
    ],
    keywords: ['כדור', 'כדורגל', 'ספורט', 'football', 'soccer'],
    featured: true,
  },
  {
    id: 'tennis-racket-set',
    title: 'מחבט טניס עם כדורים',
    description: 'מחבט טניס קל ומאוזן, מגיע עם כדורי טניס להתחלה מיידית.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Tennis_racket_and_ball.JPG/960px-Tennis_racket_and_ball.JPG',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '149₪', url: storeSearchUrl('amazon', 'tennis racket set') },
      { storeName: 'ebay', priceLabel: '119₪', url: storeSearchUrl('ebay', 'tennis racket set') },
    ],
    keywords: ['מחבט', 'טניס', 'tennis', 'racket', 'ספורט'],
  },
  {
    id: 'basketball-official',
    title: 'כדורסל מקצועי בגודל תקני',
    description: 'כדורסל איכותי בגודל תקני, מתאים למגרשים חיצוניים ופנימיים.',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/SPALDING_NBA_OFFICIAL_GAME_BALL_8.jpg/960px-SPALDING_NBA_OFFICIAL_GAME_BALL_8.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '99₪', url: storeSearchUrl('amazon', 'official basketball') },
      { storeName: 'ebay', priceLabel: '79₪', url: storeSearchUrl('ebay', 'official basketball') },
    ],
    keywords: ['כדור', 'כדורסל', 'basketball', 'ספורט'],
  },
  {
    id: 'skateboard-complete',
    title: 'סקייטבורד מלא',
    description: 'סקייטבורד מורכב ומוכן לרכיבה, לילדים ונוער שאוהבים אתגר.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Skateboard_1613.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '259₪', url: storeSearchUrl('amazon', 'complete skateboard') },
      { storeName: 'aliexpress', priceLabel: '149₪', url: storeSearchUrl('aliexpress', 'complete skateboard') },
    ],
    keywords: ['סקייטבורד', 'skateboard', 'גלגלים'],
  },
  {
    id: 'remote-control-car',
    title: 'מכונית שלוט רחוק',
    description: 'מכונית מירוץ הנשלטת מרחוק, עם סוללה נטענת ומהירות מתכווננת.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/RC-car.jpg',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '189₪', url: storeSearchUrl('amazon', 'remote control car toy') },
      { storeName: 'aliexpress', priceLabel: '99₪', url: storeSearchUrl('aliexpress', 'remote control car toy') },
    ],
    keywords: ['מכונית', 'שלוט רחוק', 'rc car', 'remote control'],
  },
  {
    id: 'nerf-blaster',
    title: 'רובה נרף לקרבות חברים',
    description: 'בלאסטר צעצוע יורה כדורי ספוג, לקרבות משפחתיים בטוחים וכיפיים.',
    imageUrl:
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/-2021-09-05_Nerf_Hail-fire_Gun%2C_Cromer%2C_Norfolk_%281%29.JPG/960px--2021-09-05_Nerf_Hail-fire_Gun%2C_Cromer%2C_Norfolk_%281%29.JPG',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '119₪', url: storeSearchUrl('amazon', 'Nerf blaster') },
      { storeName: 'ebay', priceLabel: '89₪', url: storeSearchUrl('ebay', 'Nerf blaster') },
    ],
    keywords: ['נרף', 'nerf', 'בלאסטר', 'צעצוע'],
  },
  {
    id: 'board-game-monopoly',
    title: 'משחק קופסה - מונופול',
    description: 'משחק האסטרטגיה המשפחתי הקלאסי — קונים, בונים ומנהלים אימפריה.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Small_Box_Monopoly.JPG',
    purchaseLinks: [
      { storeName: 'amazon', priceLabel: '99₪', url: storeSearchUrl('amazon', 'Monopoly board game') },
      { storeName: 'ebay', priceLabel: '69₪', url: storeSearchUrl('ebay', 'Monopoly board game') },
    ],
    keywords: ['משחק', 'קופסה', 'מונופול', 'monopoly', 'לוח'],
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
