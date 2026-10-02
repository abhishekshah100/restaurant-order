import type { Allergen, Category, CategoryId, Dish, DishImage } from '@/types/menu';

/**
 * The Olive Table menu (mock data).
 *
 * Every dish, price, description and option that appears in the design files is
 * reproduced exactly. Dishes marked `// filler` don't appear in the designs: they
 * exist so each category matches the counts the designs show
 * (Starters 8, Mains 12, Pizza 6, Breads & Rice 9, Desserts 5, Beverages 14).
 *
 * To edit the menu, change the arrays below — see README › "Changing menu data".
 */

export const categories: Category[] = [
  {
    id: 'starters',
    name: 'Starters',
    description: 'Tandoor-fired kebabs and small plates to share',
    unit: 'dishes',
  },
  {
    id: 'mains',
    name: 'Mains',
    description: 'Slow-cooked curries, fresh pasta and wood-fired pizza',
    unit: 'dishes',
  },
  {
    id: 'pizza',
    name: 'Pizza',
    description: 'Hand-stretched sourdough from the wood-fired oven',
    unit: 'dishes',
  },
  {
    id: 'breads-rice',
    name: 'Breads & Rice',
    description: 'Breads from the tandoor, biryanis and steamed rice',
    unit: 'dishes',
  },
  {
    id: 'desserts',
    name: 'Desserts',
    description: 'Indian sweets and Mediterranean classics',
    unit: 'dishes',
  },
  {
    id: 'beverages',
    name: 'Beverages',
    description: 'Coffee, chai, lassi and house mocktails',
    unit: 'drinks',
  },
];

const img = {
  pastaHero: {
    src: '/images/pasta-hero.jpg',
    alt: 'Truffle Mushroom Pasta in a stoneware bowl',
    width: 780,
    height: 540,
  },
  pastaWide: {
    src: '/images/pasta-wide.jpg',
    alt: 'Truffle Mushroom Pasta',
    width: 462,
    height: 300,
  },
  pastaSquare: {
    src: '/images/pasta-square.jpg',
    alt: 'Truffle Mushroom Pasta',
    width: 240,
    height: 240,
  },
  prawns: { src: '/images/prawns.jpg', alt: 'Chilli Garlic Prawns', width: 240, height: 228 },
  pizzaWide: {
    src: '/images/pizza-wide.jpg',
    alt: 'Wood-fired Margherita',
    width: 462,
    height: 300,
  },
  pizzaSquare: {
    src: '/images/pizza-square.jpg',
    alt: 'Wood-fired Margherita',
    width: 240,
    height: 240,
  },
  latte: { src: '/images/latte.jpg', alt: 'Iced Hazelnut Latte', width: 200, height: 248 },
} satisfies Record<string, DishImage>;

type DishInput = Omit<Dish, 'categoryId' | 'rank' | 'tags' | 'allergens' | 'availability'> &
  Partial<Pick<Dish, 'tags' | 'allergens' | 'availability'>>;

/** Fills defaults and assigns category + "Recommended" rank from list order. */
function inCategory(categoryId: CategoryId, list: DishInput[]): Dish[] {
  return list.map((dish, index) => ({
    tags: [],
    allergens: [] as Allergen[],
    availability: { status: 'available' },
    ...dish,
    categoryId,
    rank: index,
  }));
}

const SPICE = { id: 'spice', name: 'Spice level', choices: ['Mild', 'Medium', 'Hot'] };

const starters = inCategory('starters', [
  {
    slug: 'paneer-tikka',
    name: 'Paneer Tikka',
    description: 'Charred cottage cheese, hung-curd marinade, peppers and onion, mint chutney.',
    longDescription:
      'Charred cottage cheese, hung-curd marinade, peppers and onion. Served with mint chutney.',
    veg: true,
    price: 329,
    variantLabel: 'Portion',
    variants: [
      { id: 'half', name: 'Half · 6 pcs', price: 329 },
      { id: 'full', name: 'Full · 10 pcs', price: 549 },
    ],
    optionGroups: [SPICE],
    addOns: [
      { id: 'extra-paneer', name: 'Extra paneer (4 pcs)', price: 90 },
      { id: 'mint-chutney', name: 'Extra mint chutney', price: 0 },
    ],
    tags: ['bestseller'],
    prepTime: '15–18 min',
    serves: 2,
    allergens: ['dairy'],
  },
  {
    slug: 'chilli-garlic-prawns',
    name: 'Chilli Garlic Prawns',
    description: 'Tiger prawns tossed in burnt garlic, Kashmiri chilli butter and spring onion.',
    veg: false,
    price: 449,
    spice: 'medium',
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['shellfish', 'dairy'],
    image: img.prawns,
    thumb: img.prawns,
    featured: true,
  },
  {
    slug: 'dahi-kebab',
    name: 'Dahi Kebab',
    description: 'Crisp hung-curd patties with green chilli and cardamom, beetroot chutney.',
    veg: true,
    price: 289,
    tags: ['new'],
    prepTime: '12–15 min',
    serves: 2,
    allergens: ['dairy', 'gluten'],
  },
  {
    slug: 'hara-bhara-kebab',
    name: 'Hara Bhara Kebab',
    description: 'Spinach, peas and potato patties with mint yoghurt.',
    veg: true,
    price: 259,
    prepTime: '12–15 min',
    serves: 2,
    allergens: ['dairy'],
  },
  {
    slug: 'chicken-malai-tikka',
    name: 'Chicken Malai Tikka',
    description: 'Cream-and-cheese marinated chicken from the tandoor.',
    veg: false,
    price: 389,
    prepTime: '18–20 min',
    serves: 2,
    allergens: ['dairy'],
    availability: { status: 'sold-out', backAt: '8 PM' },
  },
  {
    slug: 'tandoori-broccoli',
    name: 'Tandoori Broccoli',
    description: 'Cheese-and-cashew marinated florets, chaat masala.',
    veg: true,
    price: 299,
    prepTime: '12–15 min',
    serves: 2,
    allergens: ['dairy', 'nuts'],
  },
  // filler
  {
    slug: 'amritsari-fish-tikka',
    name: 'Amritsari Fish Tikka',
    description: 'Gram-flour battered river sole with ajwain and lemon.',
    veg: false,
    price: 399,
    spice: 'mild',
    prepTime: '12–15 min',
    serves: 2,
    allergens: ['egg'],
  },
  // filler
  {
    slug: 'crispy-corn-chaat',
    name: 'Crispy Corn Chaat',
    description: 'Fried sweetcorn tossed with onion, tomato, lime and chaat masala.',
    veg: true,
    price: 249,
    prepTime: '8–10 min',
    serves: 2,
    allergens: ['gluten'],
  },
]);

const mains = inCategory('mains', [
  {
    slug: 'truffle-mushroom-pasta',
    name: 'Truffle Mushroom Pasta',
    description: 'Spaghetti, wild mushrooms, truffle oil, aged parmesan and fresh herbs.',
    longDescription:
      'Spaghetti tossed with wild mushrooms, a splash of white truffle oil, aged parmesan and fresh garden herbs.',
    veg: true,
    price: 369,
    variantLabel: 'Choose a size',
    variants: [
      { id: 'regular', name: 'Regular', description: 'Perfect for one', price: 369 },
      { id: 'large', name: 'Large', description: 'Good for sharing', price: 469 },
    ],
    addOns: [
      { id: 'parmesan', name: 'Extra parmesan', price: 40 },
      { id: 'grilled-mushrooms', name: 'Grilled mushrooms', price: 60 },
      { id: 'garlic-bread', name: 'Garlic bread (2 pcs)', price: 80 },
      { id: 'chilli-flakes', name: 'Chilli flakes', price: 0 },
    ],
    maxAddOns: 3,
    quickInstructions: ['Less cheese', 'No garlic', 'Extra hot', 'Jain'],
    tags: ['chef'],
    prepTime: '15–18 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
    image: img.pastaHero,
    thumb: img.pastaSquare,
    featured: true,
  },
  {
    slug: 'old-delhi-butter-chicken',
    name: 'Old Delhi Butter Chicken',
    description: 'Tandoori chicken simmered in a velvety tomato, butter and fenugreek gravy.',
    veg: false,
    price: 449,
    tags: ['bestseller'],
    spice: 'mild',
    prepTime: '15–18 min',
    serves: 1,
    allergens: ['dairy', 'nuts'],
  },
  {
    slug: 'wood-fired-margherita',
    name: 'Wood-fired Margherita',
    description: 'San Marzano tomato, fior di latte, basil and cold-pressed olive oil.',
    veg: true,
    price: 279,
    variantLabel: 'Choose a size',
    variants: [
      { id: 'regular', name: '10"', description: 'Perfect for one', price: 279 },
      { id: 'large', name: '13"', description: 'Good for sharing', price: 399 },
    ],
    addOns: [
      { id: 'burrata', name: 'Burrata', price: 120 },
      { id: 'olives', name: 'Kalamata olives', price: 40 },
      { id: 'jalapenos', name: 'Jalapeños', price: 30 },
      { id: 'chilli-oil', name: 'Chilli oil', price: 0 },
    ],
    maxAddOns: 3,
    quickInstructions: ['Well done', 'Less cheese', 'Jain'],
    tags: ['new'],
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
    image: img.pizzaWide,
    thumb: img.pizzaSquare,
    featured: true,
  },
  {
    slug: 'dal-makhani',
    name: 'Dal Makhani',
    description: 'Black lentils slow-cooked overnight with butter and cream.',
    veg: true,
    price: 299,
    tags: ['bestseller'],
    prepTime: '10–12 min',
    serves: 2,
    allergens: ['dairy'],
  },
  {
    slug: 'paneer-lababdar',
    name: 'Paneer Lababdar',
    description: 'Paneer in a rich onion-tomato gravy with cashew and kasuri methi.',
    veg: true,
    price: 379,
    variantLabel: 'Portion',
    variants: [
      { id: 'regular', name: 'Regular', description: 'Serves 1–2', price: 379 },
      { id: 'large', name: 'Large', description: 'Serves 3–4', price: 579 },
    ],
    optionGroups: [{ ...SPICE, choices: ['Medium', 'Mild', 'Hot'] }],
    spice: 'medium',
    prepTime: '15–18 min',
    serves: 2,
    allergens: ['dairy', 'nuts'],
  },
  {
    slug: 'palak-paneer',
    name: 'Palak Paneer',
    description: 'Fresh spinach purée, garlic tempering, soft paneer cubes.',
    veg: true,
    price: 349,
    prepTime: '12–15 min',
    serves: 2,
    allergens: ['dairy'],
  },
  // filler
  {
    slug: 'malai-kofta',
    name: 'Malai Kofta',
    description: 'Potato and cottage-cheese dumplings in a mild saffron and cashew gravy.',
    veg: true,
    price: 359,
    prepTime: '15–18 min',
    serves: 2,
    allergens: ['dairy', 'nuts'],
  },
  {
    slug: 'wild-mushroom-risotto',
    name: 'Wild Mushroom Risotto',
    description: 'Arborio rice, porcini stock, mascarpone and thyme.',
    veg: true,
    price: 419,
    prepTime: '20–22 min',
    serves: 1,
    allergens: ['dairy'],
    availability: { status: 'unavailable-today' },
  },
  // filler
  {
    slug: 'lamb-rogan-josh',
    name: 'Lamb Rogan Josh',
    description: 'Kashmiri lamb curry with ratan jot, fennel and dried ginger.',
    veg: false,
    price: 519,
    spice: 'medium',
    prepTime: '15–18 min',
    serves: 1,
    allergens: ['dairy'],
  },
  // filler
  {
    slug: 'goan-fish-curry',
    name: 'Goan Fish Curry',
    description: 'Kingfish in a tangy coconut, kokum and red chilli curry.',
    veg: false,
    price: 489,
    spice: 'hot',
    prepTime: '15–18 min',
    serves: 1,
    allergens: [],
  },
  // filler
  {
    slug: 'chicken-chettinad',
    name: 'Chicken Chettinad',
    description: 'Peppery Chettinad masala with curry leaves and roasted coconut.',
    veg: false,
    price: 429,
    spice: 'hot',
    prepTime: '15–18 min',
    serves: 1,
    allergens: [],
  },
  // filler
  {
    slug: 'prawn-linguine',
    name: 'Prawn Linguine',
    description: 'Linguine, garlic prawns, cherry tomato, chilli and lemon butter.',
    veg: false,
    price: 499,
    prepTime: '15–18 min',
    serves: 1,
    allergens: ['shellfish', 'gluten', 'dairy'],
  },
]);

// filler — the whole Pizza category (the Margherita is drawn under Mains)
const pizza = inCategory('pizza', [
  {
    slug: 'burrata-basil-pizza',
    name: 'Burrata & Basil',
    description: 'Tomato, torn burrata, basil pesto and cracked pepper.',
    veg: true,
    price: 449,
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten', 'nuts'],
  },
  {
    slug: 'quattro-formaggi',
    name: 'Quattro Formaggi',
    description: 'Mozzarella, gorgonzola, parmesan and smoked scamorza.',
    veg: true,
    price: 429,
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
  },
  {
    slug: 'roasted-veg-olive',
    name: 'Roasted Veg & Olive',
    description: 'Charred peppers, courgette, red onion and Kalamata olives.',
    veg: true,
    price: 389,
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
  },
  {
    slug: 'mushroom-truffle-pizza',
    name: 'Mushroom & Truffle',
    description: 'Wild mushrooms, fior di latte, thyme and white truffle oil.',
    veg: true,
    price: 469,
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
  },
  {
    slug: 'chicken-pesto-pizza',
    name: 'Chicken Pesto',
    description: 'Basil pesto, roast chicken, sun-dried tomato and rocket.',
    veg: false,
    price: 459,
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten', 'nuts'],
  },
  {
    slug: 'spicy-lamb-pizza',
    name: 'Spicy Lamb',
    description: 'Harissa lamb, red onion, mint yoghurt and pickled chilli.',
    veg: false,
    price: 489,
    spice: 'hot',
    prepTime: '12–15 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
  },
]);

const breadsRice = inCategory('breads-rice', [
  // filler
  {
    slug: 'garlic-naan',
    name: 'Garlic Naan',
    description: 'Tandoor-baked naan with garlic, coriander and butter.',
    veg: true,
    price: 89,
    prepTime: '6–8 min',
    serves: 1,
    allergens: ['gluten', 'dairy'],
  },
  {
    slug: 'paneer-kulcha',
    name: 'Paneer Kulcha',
    description: 'Tandoor-baked bread stuffed with spiced paneer and coriander.',
    veg: true,
    price: 119,
    prepTime: '8–10 min',
    serves: 1,
    allergens: ['gluten', 'dairy'],
  },
  // filler
  {
    slug: 'butter-naan',
    name: 'Butter Naan',
    description: 'Soft leavened bread brushed with butter.',
    veg: true,
    price: 79,
    prepTime: '6–8 min',
    serves: 1,
    allergens: ['gluten', 'dairy'],
  },
  // filler
  {
    slug: 'tandoori-roti',
    name: 'Tandoori Roti',
    description: 'Whole-wheat flatbread from the clay oven.',
    veg: true,
    price: 49,
    prepTime: '5–6 min',
    serves: 1,
    allergens: ['gluten'],
  },
  // filler
  {
    slug: 'laccha-paratha',
    name: 'Laccha Paratha',
    description: 'Flaky layered whole-wheat paratha.',
    veg: true,
    price: 89,
    prepTime: '6–8 min',
    serves: 1,
    allergens: ['gluten', 'dairy'],
  },
  // filler
  {
    slug: 'veg-dum-biryani',
    name: 'Veg Dum Biryani',
    description: 'Basmati and seasonal vegetables sealed and slow-cooked with saffron.',
    veg: true,
    price: 349,
    prepTime: '18–20 min',
    serves: 1,
    allergens: ['dairy', 'nuts'],
  },
  // filler
  {
    slug: 'chicken-dum-biryani',
    name: 'Chicken Dum Biryani',
    description: 'Hyderabadi-style biryani with marinated chicken, mint and fried onion.',
    veg: false,
    price: 429,
    spice: 'medium',
    prepTime: '18–20 min',
    serves: 1,
    allergens: ['dairy'],
  },
  // filler
  {
    slug: 'jeera-rice',
    name: 'Jeera Rice',
    description: 'Basmati tempered with cumin and ghee.',
    veg: true,
    price: 179,
    prepTime: '8–10 min',
    serves: 1,
    allergens: ['dairy'],
  },
  // filler
  {
    slug: 'steamed-rice',
    name: 'Steamed Rice',
    description: 'Plain long-grain basmati.',
    veg: true,
    price: 149,
    prepTime: '5–6 min',
    serves: 1,
    allergens: [],
  },
]);

// filler — Tiramisu is named in the design's "Popular" searches
const desserts = inCategory('desserts', [
  {
    slug: 'tiramisu',
    name: 'Tiramisu',
    description: 'Espresso-soaked savoiardi, mascarpone cream and cocoa.',
    veg: true,
    price: 299,
    tags: ['bestseller'],
    prepTime: '5 min',
    serves: 1,
    allergens: ['dairy', 'gluten', 'egg'],
  },
  {
    slug: 'gulab-jamun',
    name: 'Gulab Jamun',
    description: 'Warm milk dumplings in cardamom and rose syrup.',
    veg: true,
    price: 179,
    prepTime: '5 min',
    serves: 1,
    allergens: ['dairy', 'gluten'],
  },
  {
    slug: 'kulfi-falooda',
    name: 'Kulfi Falooda',
    description: 'Pistachio kulfi, rose syrup, vermicelli and basil seeds.',
    veg: true,
    price: 229,
    prepTime: '5 min',
    serves: 1,
    allergens: ['dairy', 'nuts'],
  },
  {
    slug: 'baked-cheesecake',
    name: 'Baked Cheesecake',
    description: 'New York-style cheesecake with seasonal berry compote.',
    veg: true,
    price: 319,
    prepTime: '5 min',
    serves: 1,
    allergens: ['dairy', 'gluten', 'egg'],
  },
  {
    slug: 'chocolate-fondant',
    name: 'Chocolate Fondant',
    description: 'Molten dark chocolate cake with vanilla bean ice cream.',
    veg: true,
    price: 339,
    tags: ['new'],
    prepTime: '12–14 min',
    serves: 1,
    allergens: ['dairy', 'gluten', 'egg'],
  },
]);

const MILK = { id: 'milk', name: 'Milk', choices: ['Dairy', 'Oat milk'] };

const beverages = inCategory('beverages', [
  {
    slug: 'iced-hazelnut-latte',
    name: 'Iced Hazelnut Latte',
    description: 'Double espresso, hazelnut and cold milk over ice.',
    veg: true,
    price: 199,
    variantLabel: 'Choose a size',
    variants: [
      { id: 'regular', name: 'Regular', description: '350 ml', price: 199 },
      { id: 'large', name: 'Large', description: '500 ml', price: 239 },
    ],
    optionGroups: [MILK],
    prepTime: '4–5 min',
    serves: 1,
    allergens: ['dairy', 'nuts'],
    image: img.latte,
    thumb: img.latte,
  },
  // fillers below — "Cold coffee" and "Mocktails" are named in the design's searches
  {
    slug: 'cold-coffee',
    name: 'Cold Coffee',
    description: 'Blended coffee, milk and a scoop of vanilla ice cream.',
    veg: true,
    price: 179,
    tags: ['bestseller'],
    prepTime: '4–5 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'cappuccino',
    name: 'Cappuccino',
    description: 'Double espresso with steamed, foamed milk.',
    veg: true,
    price: 169,
    prepTime: '3–4 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'filter-coffee',
    name: 'Filter Coffee',
    description: 'South Indian decoction with frothed milk and jaggery.',
    veg: true,
    price: 119,
    prepTime: '3–4 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'masala-chai',
    name: 'Masala Chai',
    description: 'Assam tea brewed with ginger, cardamom and milk.',
    veg: true,
    price: 99,
    prepTime: '4–5 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'mango-lassi',
    name: 'Mango Lassi',
    description: 'Alphonso mango, yoghurt and a pinch of cardamom.',
    veg: true,
    price: 159,
    prepTime: '3–4 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'sweet-lassi',
    name: 'Sweet Lassi',
    description: 'Churned yoghurt with sugar and rose water.',
    veg: true,
    price: 139,
    prepTime: '3–4 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'masala-chaas',
    name: 'Masala Chaas',
    description: 'Spiced buttermilk with roasted cumin and mint.',
    veg: true,
    price: 99,
    prepTime: '2–3 min',
    serves: 1,
    allergens: ['dairy'],
  },
  {
    slug: 'virgin-mojito',
    name: 'Virgin Mojito',
    description: 'Mocktail of muddled mint, lime and soda.',
    veg: true,
    price: 199,
    prepTime: '3–4 min',
    serves: 1,
    allergens: [],
  },
  {
    slug: 'watermelon-cooler',
    name: 'Watermelon Cooler',
    description: 'Mocktail of fresh watermelon, basil and black salt.',
    veg: true,
    price: 189,
    prepTime: '3–4 min',
    serves: 1,
    allergens: [],
  },
  {
    slug: 'kokum-spritzer',
    name: 'Kokum Spritzer',
    description: 'Mocktail of kokum, ginger and sparkling water.',
    veg: true,
    price: 189,
    prepTime: '3–4 min',
    serves: 1,
    allergens: [],
  },
  {
    slug: 'fresh-lime-soda',
    name: 'Fresh Lime Soda',
    description: 'Sweet, salted or mixed.',
    veg: true,
    price: 129,
    optionGroups: [{ id: 'style', name: 'Style', choices: ['Sweet', 'Salted', 'Mixed'] }],
    prepTime: '2–3 min',
    serves: 1,
    allergens: [],
  },
  {
    slug: 'fresh-orange-juice',
    name: 'Fresh Orange Juice',
    description: 'Pressed to order.',
    veg: true,
    price: 179,
    prepTime: '3–4 min',
    serves: 1,
    allergens: [],
  },
  {
    slug: 'mineral-water',
    name: 'Mineral Water',
    description: '1 litre, chilled or room temperature.',
    veg: true,
    price: 49,
    prepTime: '1 min',
    serves: 2,
    allergens: [],
  },
]);

export const dishes: Dish[] = [
  ...starters,
  ...mains,
  ...pizza,
  ...breadsRice,
  ...desserts,
  ...beverages,
];

/** Chef's picks rail, in the order drawn (02 / w02). */
export const chefsPicks = [
  'truffle-mushroom-pasta',
  'chilli-garlic-prawns',
  'wood-fired-margherita',
];

/** Search suggestions shown under "Popular at The Olive Table". */
export const popularSearches = [
  'Butter chicken',
  'Truffle pasta',
  'Garlic naan',
  'Biryani',
  'Tiramisu',
  'Mocktails',
];

/** Seed for "Recent searches" on a first visit, as drawn. */
export const defaultRecentSearches = ['Paneer', 'Cold coffee'];

/** Suggestions on the empty-cart screen. */
export const popularAtTable = [
  { slug: 'truffle-mushroom-pasta', label: 'Truffle Pasta' },
  { slug: 'wood-fired-margherita', label: 'Margherita' },
  { slug: 'chilli-garlic-prawns', label: 'Garlic Prawns' },
];
