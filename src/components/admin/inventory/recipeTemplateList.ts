import type { RecipeTemplate, TemplateLine } from '@/lib/recipeTemplates';
import type { InventoryUnit } from '@/types/inventory';

/*
 * Typical amounts for one full plate of common Indian restaurant dishes: a quick start, meant to
 * be adjusted to each kitchen. Ingredient names match Get started's ready list, with the other
 * names they often go by.
 */

const n = (
  names: string | readonly string[],
  quantity: number,
  unit: InventoryUnit,
): TemplateLine => ({
  names: typeof names === 'string' ? [names] : names,
  quantity,
  unit,
});

const OIL = ['Cooking oil', 'Sunflower oil', 'Refined oil', 'Vegetable oil', 'Oil'];
const GG = ['Ginger-garlic paste', 'Ginger garlic paste'];
const CHILLI = ['Red chilli powder', 'Chilli powder'];
const CREAM = ['Fresh cream', 'Cream'];
const CHICKEN = ['Chicken (boneless)', 'Boneless chicken', 'Chicken boneless'];
const CHICKEN_BONE = ['Chicken (with bone)', 'Chicken curry cut', 'Chicken'];
const MAIDA = ['Refined flour (maida)', 'Maida', 'Refined flour'];
const ATTA = ['Wheat flour (atta)', 'Atta', 'Wheat flour'];
const RICE = ['Basmati rice', 'Rice'];
const MUTTON = ['Mutton', 'Lamb'];
const WATER = ['Mineral water bottle', 'Mineral water (1 l)', 'Mineral water'];

export const RECIPE_TEMPLATES: readonly RecipeTemplate[] = [
  // Starters
  {
    dishes: ['Paneer Tikka'],
    lines: [
      n('Paneer', 200, 'g'),
      n('Curd', 40, 'g'),
      n('Capsicum', 40, 'g'),
      n('Onion', 40, 'g'),
      n(GG, 10, 'g'),
      n(CHILLI, 3, 'g'),
      n('Garam masala', 2, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Chicken Tikka', 'Chicken Malai Tikka', 'Malai Tikka'],
    lines: [
      n(CHICKEN, 220, 'g'),
      n('Curd', 40, 'g'),
      n(CREAM, 20, 'ml'),
      n(GG, 10, 'g'),
      n(CHILLI, 3, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Tandoori Chicken'],
    lines: [
      n(CHICKEN_BONE, 400, 'g'),
      n('Curd', 60, 'g'),
      n(GG, 15, 'g'),
      n(CHILLI, 5, 'g'),
      n('Lemon', 0.5, 'pc'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Hara Bhara Kebab'],
    lines: [
      n('Spinach', 60, 'g'),
      n('Green peas', 40, 'g'),
      n('Potato', 80, 'g'),
      n('Paneer', 30, 'g'),
      n(['Gram flour (besan)', 'Besan', 'Gram flour'], 15, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  {
    dishes: ['Dahi Kebab'],
    lines: [
      n('Curd', 120, 'g'),
      n('Paneer', 40, 'g'),
      n(['Gram flour (besan)', 'Besan', 'Gram flour'], 20, 'g'),
      n(OIL, 25, 'ml'),
    ],
  },
  {
    dishes: ['Amritsari Fish', 'Fish Tikka', 'Fish Fry'],
    lines: [
      n('Fish', 200, 'g'),
      n(['Gram flour (besan)', 'Besan', 'Gram flour'], 30, 'g'),
      n(GG, 8, 'g'),
      n(CHILLI, 3, 'g'),
      n(OIL, 40, 'ml'),
    ],
  },
  // Mains
  {
    dishes: ['Butter Chicken', 'Chicken Makhani', 'Murgh Makhani'],
    lines: [
      n(CHICKEN, 220, 'g'),
      n('Tomato', 150, 'g'),
      n('Butter', 25, 'g'),
      n(CREAM, 40, 'ml'),
      n(['Cashew nuts', 'Cashew'], 10, 'g'),
      n(GG, 10, 'g'),
      n('Kasuri methi', 1, 'g'),
      n(CHILLI, 3, 'g'),
    ],
  },
  {
    dishes: ['Chicken Curry', 'Kadai Chicken', 'Chicken Masala'],
    lines: [
      n(CHICKEN_BONE, 250, 'g'),
      n('Onion', 100, 'g'),
      n('Tomato', 100, 'g'),
      n(GG, 10, 'g'),
      n(['Coriander powder'], 3, 'g'),
      n(['Turmeric powder', 'Turmeric'], 1, 'g'),
      n('Garam masala', 3, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  {
    dishes: ['Rogan Josh', 'Mutton Curry', 'Lamb Curry', 'Mutton Masala'],
    lines: [
      n(MUTTON, 250, 'g'),
      n('Curd', 50, 'g'),
      n('Onion', 80, 'g'),
      n(GG, 10, 'g'),
      n(CHILLI, 4, 'g'),
      n('Garam masala', 3, 'g'),
      n(OIL, 25, 'ml'),
    ],
  },
  {
    dishes: ['Fish Curry'],
    lines: [
      n('Fish', 220, 'g'),
      n('Onion', 60, 'g'),
      n('Tomato', 60, 'g'),
      n(['Turmeric powder', 'Turmeric'], 1, 'g'),
      n(CHILLI, 3, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  {
    dishes: ['Prawn Curry', 'Prawn Masala', 'Garlic Prawns', 'Chilli Garlic Prawns'],
    lines: [
      n('Prawns', 180, 'g'),
      n('Onion', 60, 'g'),
      n('Tomato', 60, 'g'),
      n('Garlic', 8, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  {
    dishes: ['Paneer Butter Masala', 'Paneer Makhani', 'Paneer Lababdar', 'Shahi Paneer'],
    lines: [
      n('Paneer', 180, 'g'),
      n('Tomato', 150, 'g'),
      n('Onion', 60, 'g'),
      n('Butter', 20, 'g'),
      n(CREAM, 30, 'ml'),
      n(['Cashew nuts', 'Cashew'], 10, 'g'),
      n('Kasuri methi', 1, 'g'),
      n(CHILLI, 3, 'g'),
      n(OIL, 10, 'ml'),
    ],
  },
  {
    dishes: ['Kadai Paneer', 'Paneer Do Pyaza'],
    lines: [
      n('Paneer', 180, 'g'),
      n('Capsicum', 60, 'g'),
      n('Onion', 80, 'g'),
      n('Tomato', 100, 'g'),
      n(['Coriander powder'], 3, 'g'),
      n(CHILLI, 3, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Palak Paneer', 'Saag Paneer'],
    lines: [
      n('Paneer', 150, 'g'),
      n('Spinach', 200, 'g'),
      n('Onion', 50, 'g'),
      n('Tomato', 50, 'g'),
      n('Garlic', 5, 'g'),
      n(CREAM, 20, 'ml'),
      n(['Cumin seeds', 'Cumin'], 2, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Malai Kofta'],
    lines: [
      n('Paneer', 80, 'g'),
      n('Potato', 80, 'g'),
      n('Tomato', 120, 'g'),
      n(CREAM, 40, 'ml'),
      n(['Cashew nuts', 'Cashew'], 15, 'g'),
      n('Butter', 15, 'g'),
      n(OIL, 30, 'ml'),
    ],
  },
  {
    dishes: ['Dal Makhani'],
    lines: [
      n(['Black lentils (urad)', 'Urad dal', 'Black lentils'], 80, 'g'),
      n(['Kidney beans (rajma)', 'Rajma'], 15, 'g'),
      n('Butter', 25, 'g'),
      n(CREAM, 30, 'ml'),
      n('Tomato', 60, 'g'),
      n(GG, 8, 'g'),
      n(CHILLI, 2, 'g'),
    ],
  },
  {
    dishes: ['Dal Tadka', 'Dal Fry', 'Yellow Dal'],
    lines: [
      n(['Toor dal', 'Arhar dal'], 90, 'g'),
      n('Onion', 30, 'g'),
      n('Tomato', 40, 'g'),
      n('Garlic', 5, 'g'),
      n(['Cumin seeds', 'Cumin'], 2, 'g'),
      n(['Turmeric powder', 'Turmeric'], 1, 'g'),
      n('Ghee', 10, 'g'),
    ],
  },
  {
    dishes: ['Chana Masala', 'Chole', 'Pindi Chole'],
    lines: [
      n(['Chickpeas (chana)', 'Chickpeas', 'Kabuli chana'], 100, 'g'),
      n('Onion', 60, 'g'),
      n('Tomato', 80, 'g'),
      n(GG, 8, 'g'),
      n('Garam masala', 3, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Rajma', 'Rajma Masala'],
    lines: [
      n(['Kidney beans (rajma)', 'Rajma'], 100, 'g'),
      n('Onion', 60, 'g'),
      n('Tomato', 80, 'g'),
      n(GG, 8, 'g'),
      n(OIL, 15, 'ml'),
    ],
  },
  {
    dishes: ['Veg Thali'],
    lines: [
      n('Paneer', 80, 'g'),
      n(['Black lentils (urad)', 'Toor dal'], 50, 'g'),
      n(RICE, 100, 'g'),
      n(ATTA, 60, 'g'),
      n('Curd', 80, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  {
    dishes: ['Non-veg Thali', 'Non Veg Thali'],
    lines: [
      n(CHICKEN, 120, 'g'),
      n(['Black lentils (urad)', 'Toor dal'], 50, 'g'),
      n(RICE, 100, 'g'),
      n(ATTA, 60, 'g'),
      n('Curd', 80, 'g'),
      n(OIL, 20, 'ml'),
    ],
  },
  // Rice
  {
    dishes: ['Chicken Biryani', 'Chicken Dum Biryani'],
    lines: [
      n(RICE, 150, 'g'),
      n(CHICKEN_BONE, 200, 'g'),
      n('Curd', 40, 'g'),
      n('Onion', 80, 'g'),
      n('Mint leaves', 5, 'g'),
      n(GG, 10, 'g'),
      n('Garam masala', 3, 'g'),
      n('Ghee', 15, 'g'),
    ],
  },
  {
    dishes: ['Mutton Biryani', 'Lamb Biryani'],
    lines: [
      n(RICE, 150, 'g'),
      n(MUTTON, 200, 'g'),
      n('Curd', 40, 'g'),
      n('Onion', 80, 'g'),
      n('Mint leaves', 5, 'g'),
      n('Garam masala', 3, 'g'),
      n('Ghee', 15, 'g'),
    ],
  },
  {
    dishes: ['Veg Biryani', 'Veg Dum Biryani', 'Vegetable Biryani'],
    lines: [
      n(RICE, 150, 'g'),
      n('Potato', 50, 'g'),
      n('Carrot', 40, 'g'),
      n('Green peas', 30, 'g'),
      n('Cauliflower', 40, 'g'),
      n('Curd', 30, 'g'),
      n('Onion', 60, 'g'),
      n('Ghee', 15, 'g'),
    ],
  },
  {
    dishes: ['Jeera Rice'],
    lines: [n(RICE, 120, 'g'), n(['Cumin seeds', 'Cumin'], 3, 'g'), n('Ghee', 8, 'g')],
  },
  { dishes: ['Steamed Rice', 'Plain Rice'], lines: [n(RICE, 120, 'g')] },
  // Breads
  {
    dishes: ['Butter Naan'],
    lines: [n(MAIDA, 90, 'g'), n('Curd', 10, 'g'), n('Butter', 10, 'g'), n('Sugar', 2, 'g')],
  },
  {
    dishes: ['Garlic Naan'],
    lines: [n(MAIDA, 90, 'g'), n('Garlic', 8, 'g'), n('Butter', 10, 'g'), n('Curd', 10, 'g')],
  },
  { dishes: ['Naan', 'Plain Naan'], lines: [n(MAIDA, 90, 'g'), n('Curd', 10, 'g')] },
  {
    dishes: ['Paneer Kulcha', 'Kulcha'],
    lines: [n(MAIDA, 90, 'g'), n('Paneer', 40, 'g'), n('Butter', 8, 'g')],
  },
  { dishes: ['Tandoori Roti', 'Roti', 'Chapati'], lines: [n(ATTA, 70, 'g')] },
  {
    dishes: ['Laccha Paratha', 'Lachha Paratha', 'Paratha'],
    lines: [n(ATTA, 90, 'g'), n('Ghee', 12, 'g')],
  },
  // Pizza
  {
    dishes: ['Margherita', 'Cheese Pizza'],
    lines: [n(MAIDA, 150, 'g'), n('Cheese', 120, 'g'), n('Tomato', 60, 'g'), n(OIL, 10, 'ml')],
  },
  // Drinks
  {
    dishes: ['Masala Chai', 'Chai', 'Tea'],
    lines: [
      n('Milk', 100, 'ml'),
      n('Tea leaves', 4, 'g'),
      n('Sugar', 10, 'g'),
      n('Ginger', 3, 'g'),
    ],
  },
  {
    dishes: ['Filter Coffee', 'Coffee', 'Cappuccino', 'Latte'],
    lines: [n('Milk', 150, 'ml'), n('Coffee powder', 8, 'g'), n('Sugar', 10, 'g')],
  },
  {
    dishes: ['Cold Coffee', 'Iced Coffee'],
    lines: [n('Milk', 200, 'ml'), n('Coffee powder', 6, 'g'), n('Sugar', 20, 'g')],
  },
  {
    dishes: ['Mango Lassi'],
    lines: [n('Curd', 200, 'g'), n(['Mango pulp'], 80, 'g'), n('Sugar', 15, 'g')],
  },
  { dishes: ['Sweet Lassi', 'Lassi'], lines: [n('Curd', 250, 'g'), n('Sugar', 25, 'g')] },
  {
    dishes: ['Masala Chaas', 'Chaas', 'Buttermilk'],
    lines: [n('Curd', 120, 'g'), n(['Cumin seeds', 'Cumin'], 1, 'g'), n('Mint leaves', 3, 'g')],
  },
  {
    dishes: ['Fresh Lime Soda', 'Lime Soda', 'Nimbu Pani'],
    lines: [n('Lemon', 1, 'pc'), n('Sugar', 20, 'g')],
  },
  { dishes: ['Mineral Water'], lines: [n(WATER, 1, 'pc')] },
  { dishes: ['Soft Drink', 'Coke', 'Pepsi'], lines: [n('Soft drink', 1, 'pc')] },
];
