/** All prices are integer rupees. */
export type Rupees = number;

export type CategoryId = 'starters' | 'mains' | 'pizza' | 'breads-rice' | 'desserts' | 'beverages';

export interface Category {
  id: CategoryId;
  name: string;
  /** Mobile tab label when it differs from `name`. */
  shortName?: string;
  description: string;
  /** "dishes" or "drinks" — used in counts like "14 drinks". */
  unit: 'dishes' | 'drinks';
}

export type DishTag = 'chef' | 'new' | 'bestseller';

export type SpiceLevel = 'mild' | 'medium' | 'hot';

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
}

export interface OptionGroup {
  id: string;
  name: string;
  /** Choices are single-select; the first is the default. */
  choices: string[];
}

export type Availability =
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
  /** Extra single-choice groups such as spice level. */
  optionGroups?: OptionGroup[];
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
