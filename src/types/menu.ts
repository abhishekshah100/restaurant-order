/** All prices are integer rupees. */
export type Rupees = number;

export type CategoryId =
  'starters' | 'mains' | 'meals' | 'pizza' | 'breads-rice' | 'desserts' | 'beverages';

export interface Category {
  id: CategoryId;
  name: string;
  /** Mobile tab label when it differs from `name`. */
  shortName?: string;
  description: string;
  /** "dishes" or "drinks" — used in counts like "14 drinks". */
  unit: 'dishes' | 'drinks';
}

type DishTag = 'chef' | 'new' | 'bestseller';

type SpiceLevel = 'mild' | 'medium' | 'hot';

export type Allergen = 'dairy' | 'gluten' | 'nuts' | 'shellfish' | 'egg' | 'soy' | 'sesame';

export interface Variant {
  id: string;
  name: string;
  /** Secondary line, e.g. "Perfect for one". */
  description?: string;
  price: Rupees;
  available?: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  /** 0 = free. */
  price: Rupees;
  /** Only offered with these variant ids (e.g. an extra shot on Large only). Omit = every size. */
  availableFor?: string[];
  /** Size-specific price, keyed by variant id; falls back to `price`. */
  priceByVariant?: Record<string, Rupees>;
}

/** One choice in a single-select group. A plain string is shorthand for a free choice. */
export interface ChoiceSpec {
  name: string;
  /** Extra cost of picking this choice (0 / omitted = included). */
  price?: Rupees;
  /** Only offered with these variant ids. Omit = every size. */
  availableFor?: string[];
}

export interface OptionGroup {
  id: string;
  name: string;
  /** Single-select; the first available choice is the default. */
  choices: (string | ChoiceSpec)[];
  /** Only shown with these variant ids. Omit = every size. */
  availableFor?: string[];
  /**
   * Always list the chosen value in cart / order summaries (combo slots, protein).
   * Otherwise only non-default choices are listed (e.g. "Medium spicy").
   */
  showInSummary?: boolean;
}

/** An ingredient the guest can leave out ("No onion", "No garlic"). Always free. */
export interface Removable {
  id: string;
  /** Ingredient name — shown as "No <name>". */
  name: string;
}

/** Meal / combo details: the slots themselves are option groups. */
interface ComboInfo {
  /** Saving versus ordering the parts separately, for the "Save ₹X" badge. */
  savings?: Rupees;
  /** One-line contents, e.g. "Curry · Bread · Rice · Dessert · Drink". */
  includes: string;
}

type Availability =
  | { status: 'available' }
  | { status: 'sold-out'; backAt?: string }
  | { status: 'unavailable-today' };

export interface DishImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Dish {
  slug: string;
  name: string;
  /** Short line used on cards and rows. */
  description: string;
  /** Even shorter line for the chef's-pick cards; falls back to `description`. */
  cardDescription?: string;
  /** Longer copy for the food-detail page. */
  longDescription?: string;
  categoryId: CategoryId;
  veg: boolean;
  /** Base price — the cheapest variant if variants exist. */
  price: Rupees;
  variants?: Variant[];
  /** Label for the variant group, e.g. "Choose a size" or "Portion". */
  variantLabel?: string;
  addOns?: AddOn[];
  maxAddOns?: number;
  /** Extra single-choice groups such as spice level, protein or combo slots. */
  optionGroups?: OptionGroup[];
  /** Ingredients that can be left out ("No onion"). */
  removables?: Removable[];
  /** Set for meals / combos. */
  combo?: ComboInfo;
  /** Quick-instruction chips on the detail screen. */
  quickInstructions?: string[];
  tags: DishTag[];
  spice?: SpiceLevel;
  /** e.g. "15–18 min". */
  prepTime?: string;
  serves?: number;
  allergens: Allergen[];
  availability: Availability;
  /** Feature image (16:10-ish) for chef's picks and the detail hero. */
  image?: DishImage;
  /** Square thumbnail for list rows and cart lines. */
  thumb?: DishImage;
  /** Appears in the Chef's picks rail. */
  featured?: boolean;
  /** Ranking for "Recommended" sort; lower is first. */
  rank: number;
}

/** A labelled dish shortcut, e.g. the empty-cart suggestions. */
export interface DishLink {
  slug: string;
  label: string;
}

/** Everything GET /menu returns: the categories, every dish and the curated dish lists. */
export interface MenuData {
  categories: Category[];
  /** Every dish, in menu order (each category's list order is its "Recommended" rank). */
  dishes: Dish[];
  /** Chef's picks rail, in the order drawn (02 / w02). */
  chefsPicks: string[];
  /** Search suggestions shown under "Popular at The Olive Table". */
  popularSearches: string[];
  /** "Goes well with your order" on the cart: drinks and desserts, in order of preference. */
  cartSuggestions: string[];
  /** "Trending tonight" strip on the search screen (dishes with photos). */
  trendingTonight: string[];
  /** Suggestions on the empty-cart screen. */
  popularAtTable: DishLink[];
}
