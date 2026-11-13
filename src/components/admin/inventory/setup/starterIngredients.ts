import type { InventoryUnit } from '@/types/inventory';

/*
 * A ready list of ingredients most Indian restaurants keep, for Inventory › Get started: staff
 * tick what they use instead of typing every name. Each becomes the restaurant's own ingredient
 * (its name, unit and category are then theirs to change). Names and categories are written
 * here as they'll be saved; units are the ones stock is counted in.
 */

export interface StarterIngredient {
  name: string;
  unit: InventoryUnit;
}

export interface StarterGroup {
  /** Saved as the ingredient category (an existing one with this name is used). */
  category: string;
  items: readonly StarterIngredient[];
}

const kg = (name: string): StarterIngredient => ({ name, unit: 'kg' });
const l = (name: string): StarterIngredient => ({ name, unit: 'l' });
const g = (name: string): StarterIngredient => ({ name, unit: 'g' });
const pc = (name: string): StarterIngredient => ({ name, unit: 'pc' });

export const STARTER_INGREDIENTS: readonly StarterGroup[] = [
  {
    category: 'Vegetables',
    items: [
      kg('Onion'),
      kg('Tomato'),
      kg('Potato'),
      kg('Ginger'),
      kg('Garlic'),
      kg('Green chilli'),
      kg('Coriander leaves'),
      kg('Mint leaves'),
      kg('Capsicum'),
      kg('Carrot'),
      kg('Cauliflower'),
      kg('Spinach'),
      kg('Mushroom'),
      kg('Green peas'),
      pc('Lemon'),
    ],
  },
  {
    category: 'Dairy',
    items: [
      l('Milk'),
      kg('Paneer'),
      kg('Curd'),
      kg('Butter'),
      l('Fresh cream'),
      kg('Cheese'),
      kg('Ghee'),
    ],
  },
  {
    category: 'Meat & seafood',
    items: [
      kg('Chicken (boneless)'),
      kg('Chicken (with bone)'),
      kg('Mutton'),
      kg('Fish'),
      kg('Prawns'),
      pc('Eggs'),
    ],
  },
  {
    category: 'Rice, flour & dals',
    items: [
      kg('Basmati rice'),
      kg('Wheat flour (atta)'),
      kg('Refined flour (maida)'),
      kg('Gram flour (besan)'),
      kg('Toor dal'),
      kg('Black lentils (urad)'),
      kg('Chickpeas (chana)'),
      kg('Kidney beans (rajma)'),
      kg('Sugar'),
      kg('Salt'),
      kg('Cashew nuts'),
    ],
  },
  {
    category: 'Spices',
    items: [
      g('Turmeric powder'),
      g('Red chilli powder'),
      g('Coriander powder'),
      g('Cumin seeds'),
      g('Garam masala'),
      g('Kasuri methi'),
      g('Black pepper'),
    ],
  },
  {
    category: 'Oils & sauces',
    items: [l('Cooking oil'), l('Mustard oil'), kg('Tomato ketchup'), l('Soy sauce'), l('Vinegar')],
  },
  {
    category: 'Drinks',
    items: [kg('Tea leaves'), kg('Coffee powder'), pc('Mineral water bottle'), pc('Soft drink')],
  },
  {
    category: 'Packaging',
    items: [pc('Takeaway box'), pc('Carry bag'), pc('Paper napkins')],
  },
];
