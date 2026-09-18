/**
 * Generic ingredient dictionary: public reference facts only (no brands, no
 * personal doses). Seed items link to an entry by `ingredientId` so the app can
 * show a requirement hint and the published adult upper intake level.
 *
 * Upper limits are the adult tolerable upper intake levels published by the US
 * National Academies / NIH Office of Dietary Supplements. They are reference
 * numbers, not advice, and the app never suggests a dose.
 */
export interface Ingredient {
  id: string;
  name: string;
  kind: 'mineral' | 'vitamin' | 'fatty-acid' | 'amino-acid' | 'other';
  defaultUnit: string;
  /** Published adult upper intake level, when one exists. */
  ul?: { amount: number; unit: string; note: string };
  requirementHint?: 'empty-stomach' | 'with-food' | 'with-fat' | 'any';
  note?: string;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  zinc: {
    id: 'zinc', name: 'Zinc', kind: 'mineral', defaultUnit: 'mg', requirementHint: 'with-food',
    ul: { amount: 40, unit: 'mg', note: 'Adult upper intake level, all sources combined.' },
    note: 'Competes with other minerals for absorption; often dosed away from them.',
  },
  selenium: {
    id: 'selenium', name: 'Selenium', kind: 'mineral', defaultUnit: 'mcg', requirementHint: 'with-food',
    ul: { amount: 400, unit: 'mcg', note: 'Adult upper intake level, all sources combined.' },
    note: 'Multivitamins and Brazil nuts are easy-to-miss sources.',
  },
  boron: {
    id: 'boron', name: 'Boron', kind: 'mineral', defaultUnit: 'mg', requirementHint: 'with-food',
    ul: { amount: 20, unit: 'mg', note: 'Adult upper intake level.' },
  },
  magnesium: {
    id: 'magnesium', name: 'Magnesium', kind: 'mineral', defaultUnit: 'mg', requirementHint: 'any',
    ul: { amount: 350, unit: 'mg', note: 'Upper intake level for supplemental magnesium only, not food.' },
    note: 'Often split across the day; the bedtime share is common.',
  },
  vitaminD: {
    id: 'vitaminD', name: 'Vitamin D', kind: 'vitamin', defaultUnit: 'IU', requirementHint: 'with-fat',
    ul: { amount: 4000, unit: 'IU', note: 'Adult upper intake level (100 mcg).' },
    note: 'Fat-soluble: taken with dietary fat. Blood level is the thing to track.',
  },
  vitaminK: {
    id: 'vitaminK', name: 'Vitamin K', kind: 'vitamin', defaultUnit: 'mcg', requirementHint: 'with-fat',
    note: 'No upper intake level established. Interacts with warfarin and similar anticoagulants.',
  },
  omega3: {
    id: 'omega3', name: 'Omega-3 (EPA/DHA)', kind: 'fatty-acid', defaultUnit: 'mg', requirementHint: 'with-food',
    note: 'No upper intake level established.',
  },
  nac: {
    id: 'nac', name: 'N-acetylcysteine', kind: 'amino-acid', defaultUnit: 'mg', requirementHint: 'with-food',
    note: 'No upper intake level established.',
  },
  creatine: {
    id: 'creatine', name: 'Creatine monohydrate', kind: 'other', defaultUnit: 'g', requirementHint: 'any',
    note: 'No upper intake level established. Timing is flexible; splitting a larger dose is common.',
  },
  lTyrosine: {
    id: 'lTyrosine', name: 'L-Tyrosine', kind: 'amino-acid', defaultUnit: 'mg', requirementHint: 'empty-stomach',
    note: 'An amino acid: competes with dietary protein for transport, so it is usually taken away from meals.',
  },
  tongkatAli: {
    id: 'tongkatAli', name: 'Tongkat ali', kind: 'other', defaultUnit: 'mg', requirementHint: 'with-food',
    note: 'No upper intake level established.',
  },
  nootropicBlend: {
    id: 'nootropicBlend', name: 'Nootropic blend', kind: 'other', defaultUnit: 'tabs', requirementHint: 'empty-stomach',
    note: 'Multi-ingredient blends often overlap with standalone supplements; check the label before adding one.',
  },
  sleepBlend: {
    id: 'sleepBlend', name: 'Sleep blend', kind: 'other', defaultUnit: 'caps', requirementHint: 'any',
  },
  testSupportBlend: {
    id: 'testSupportBlend', name: 'Hormone-support blend', kind: 'other', defaultUnit: 'caps', requirementHint: 'with-food',
    note: 'Blends often carry minerals already in the stack; check the label before doubling up.',
  },

  // Common entries beyond any one protocol, so the dictionary is a general
  // reference rather than a copy of a particular stack.
  vitaminA: {
    id: 'vitaminA', name: 'Vitamin A (preformed)', kind: 'vitamin', defaultUnit: 'mcg', requirementHint: 'with-fat',
    ul: { amount: 3000, unit: 'mcg RAE', note: 'Adult upper intake level for preformed vitamin A (retinol).' },
  },
  vitaminC: {
    id: 'vitaminC', name: 'Vitamin C', kind: 'vitamin', defaultUnit: 'mg', requirementHint: 'any',
    ul: { amount: 2000, unit: 'mg', note: 'Adult upper intake level.' },
  },
  vitaminE: {
    id: 'vitaminE', name: 'Vitamin E', kind: 'vitamin', defaultUnit: 'mg', requirementHint: 'with-fat',
    ul: { amount: 1000, unit: 'mg', note: 'Adult upper intake level for supplemental alpha-tocopherol.' },
  },
  niacin: {
    id: 'niacin', name: 'Niacin (B3)', kind: 'vitamin', defaultUnit: 'mg', requirementHint: 'with-food',
    ul: { amount: 35, unit: 'mg', note: 'Adult upper intake level for supplemental niacin, not food.' },
  },
  vitaminB6: {
    id: 'vitaminB6', name: 'Vitamin B6', kind: 'vitamin', defaultUnit: 'mg', requirementHint: 'with-food',
    ul: { amount: 100, unit: 'mg', note: 'Adult upper intake level.' },
  },
  vitaminB12: {
    id: 'vitaminB12', name: 'Vitamin B12', kind: 'vitamin', defaultUnit: 'mcg', requirementHint: 'any',
    note: 'No upper intake level established.',
  },
  folate: {
    id: 'folate', name: 'Folate (folic acid)', kind: 'vitamin', defaultUnit: 'mcg', requirementHint: 'any',
    ul: { amount: 1000, unit: 'mcg', note: 'Adult upper intake level for supplemental folic acid.' },
  },
  calcium: {
    id: 'calcium', name: 'Calcium', kind: 'mineral', defaultUnit: 'mg', requirementHint: 'with-food',
    ul: { amount: 2500, unit: 'mg', note: 'Adult upper intake level (ages 19 to 50).' },
    note: 'Competes with iron and zinc for absorption; often dosed away from them.',
  },
  iron: {
    id: 'iron', name: 'Iron', kind: 'mineral', defaultUnit: 'mg', requirementHint: 'empty-stomach',
    ul: { amount: 45, unit: 'mg', note: 'Adult upper intake level.' },
    note: 'Absorbed better away from calcium, coffee and tea.',
  },
  iodine: {
    id: 'iodine', name: 'Iodine', kind: 'mineral', defaultUnit: 'mcg', requirementHint: 'any',
    ul: { amount: 1100, unit: 'mcg', note: 'Adult upper intake level.' },
  },
  copper: {
    id: 'copper', name: 'Copper', kind: 'mineral', defaultUnit: 'mcg', requirementHint: 'with-food',
    ul: { amount: 10000, unit: 'mcg', note: 'Adult upper intake level.' },
    note: 'Long-running high-dose zinc can lower copper status.',
  },
  melatonin: {
    id: 'melatonin', name: 'Melatonin', kind: 'other', defaultUnit: 'mg', requirementHint: 'any',
    note: 'No upper intake level established. Taken shortly before bed.',
  },
  caffeine: {
    id: 'caffeine', name: 'Caffeine', kind: 'other', defaultUnit: 'mg', requirementHint: 'any',
    note: 'No upper intake level established; the FDA cites 400 mg a day as the usual figure for healthy adults.',
  },
  ashwagandha: {
    id: 'ashwagandha', name: 'Ashwagandha', kind: 'other', defaultUnit: 'mg', requirementHint: 'with-food',
    note: 'No upper intake level established.',
  },
  collagen: {
    id: 'collagen', name: 'Collagen peptides', kind: 'other', defaultUnit: 'g', requirementHint: 'any',
    note: 'No upper intake level established.',
  },
  probiotic: {
    id: 'probiotic', name: 'Probiotic', kind: 'other', defaultUnit: 'CFU', requirementHint: 'any',
    note: 'No upper intake level established.',
  },
};

export const REQUIREMENT_LABEL: Record<string, string> = {
  'empty-stomach': 'EMPTY STOMACH',
  'with-food': 'WITH FOOD',
  'with-fat': 'WITH FAT',
  any: 'ANY TIME',
};

/** Block labels in the app's stencil style; a seed supplies its own rule text. */
export const BLOCK_LABEL: Record<string, string> = {
  wake: '01 · ON WAKE',
  breakfast: '02 · BREAKFAST',
  midday: '03 · MIDDAY',
  bedtime: '04 · BEDTIME',
};

export const DEFAULT_BLOCK_TIMES: Record<string, string> = { wake: '06:30', breakfast: '07:30', midday: '12:30', bedtime: '21:30' };
