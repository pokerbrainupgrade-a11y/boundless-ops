/**
 * Parametric stick-figure poses. Every drawing is data: joint angles in degrees
 * (absolute, SVG convention: 0° = +x right, 90° = +y down, -90° = up) plus
 * simple props. Rendered by components/Pose.tsx in a 100×100 box.
 */
export interface Figure {
  /** Hip joint position. */
  hip: [number, number];
  /** Direction from hip to shoulders (default -90 = upright). */
  torso: number;
  /** Direction from shoulders to head centre (default = torso). */
  head?: number;
  /** Arms: absolute directions of upper and lower segments. */
  uArmL: number; lArmL: number; uArmR: number; lArmR: number;
  /** Legs. */
  thighL: number; shinL: number; thighR: number; shinR: number;
  /** Which way the figure faces. */
  facing?: 'left' | 'right';
  /** Scale factor (default 1). */
  scale?: number;
}

export type Prop =
  | { type: 'floor' }
  | { type: 'wall'; x: number }
  | { type: 'roller'; x: number; y: number; angle?: number }
  | { type: 'kettlebell'; x: number; y: number }
  | { type: 'box'; x: number; y: number; w: number; h: number }
  | { type: 'bench'; x: number; y: number; w: number }
  | { type: 'bar'; x: number; y: number; w: number; angle?: number }
  | { type: 'bike'; x: number; y: number }
  | { type: 'rower'; x: number; y: number }
  | { type: 'tub'; x: number; y: number; w: number }
  | { type: 'water'; y: number }
  | { type: 'pillow'; x: number; y: number; angle?: number }
  /** Skipping-rope arc: ends at (x ± w/2, y - h), dipping to about (x, y - h/3). Defaults w=36, h=30. */
  | { type: 'rope'; x: number; y: number; w?: number; h?: number }
  | { type: 'pad'; x: number; y: number; w: number }
  | { type: 'cable'; x: number; y: number; toX: number; toY: number }
  | { type: 'arrow'; x: number; y: number; angle: number }
  | { type: 'sun' }
  | { type: 'heat'; x: number; y: number };

export interface Pose {
  id: string;
  /** Accessible description of the drawing. */
  label: string;
  figure: Figure;
  props?: Prop[];
}

export const LEN = { head: 6.5, neck: 4, torso: 22, uArm: 13, lArm: 12, thigh: 17, shin: 16 } as const;

/** Upright standing figure used as a base for variations (feet land on the floor line y=90). */
export const STAND: Figure = { hip: [50, 57], torso: -90, uArmL: 100, lArmL: 95, uArmR: 80, lArmR: 85, thighL: 95, shinL: 90, thighR: 85, shinR: 90, facing: 'right' };

const f = (over: Partial<Figure>): Figure => ({ ...STAND, ...over });

const FLOOR: Prop[] = [{ type: 'floor' }];
/** Arms open wide at the sides, elbows soft (decompression start position). */
const ARMS_OPEN = { uArmL: 150, lArmL: 160, uArmR: 30, lArmR: 20 } as const;
/** Arms raised overhead in a V. */
const ARMS_UP = { uArmL: -130, lArmL: -100, uArmR: -50, lArmR: -80 } as const;
/** Tall split stance: right leg forward, left leg back. */
const SPLIT = { thighL: 110, shinL: 100, thighR: 70, shinR: 80 } as const;
/** Lying on the back, head to the left, body on the floor. */
const SUPINE = { hip: [46, 85] as [number, number], torso: 180, uArmL: 8, lArmL: 0, uArmR: 10, lArmR: -2, facing: 'right' as const };
/** Knees bent with the feet flat (for supine poses). */
const KNEES_BENT = { thighL: -60, shinL: 70, thighR: -55, shinR: 75 } as const;

export const poses: Record<string, Pose> = {
  // ---- generic ----
  walk: { id: 'walk', label: 'Person walking briskly', figure: f({ hip: [48, 59], uArmL: 120, lArmL: 60, uArmR: 60, lArmR: 20, thighL: 120, shinL: 105, thighR: 60, shinR: 100 }), props: FLOOR },
  cardioBike: { id: 'cardioBike', label: 'Person riding a stationary bike', figure: f({ hip: [44, 52], torso: -60, uArmL: 10, lArmL: 30, uArmR: 5, lArmR: 25, thighL: 40, shinL: 100, thighR: 100, shinR: 60 }), props: [{ type: 'bike', x: 58, y: 84 }, { type: 'floor' }] },
  rower: { id: 'rower', label: 'Person on a rowing machine, seated on the rail with knees bent, pulling the handle to the chest', figure: f({ hip: [42, 78], torso: -100, uArmL: 165, lArmL: 5, uArmR: 160, lArmR: 10, thighL: -40, shinL: 38, thighR: -38, shinR: 35 }), props: [{ type: 'rower', x: 30, y: 84 }, { type: 'cable', x: 40, y: 63, toX: 70, toY: 72 }, { type: 'floor' }] },
  breathing: { id: 'breathing', label: 'Person standing tall with hands on ribs, breathing', figure: f({ uArmL: 120, lArmL: 190, uArmR: 60, lArmR: 350, thighL: 92, shinL: 90, thighR: 88, shinR: 90 }), props: FLOOR },
  cold: { id: 'cold', label: 'Person standing in a cold tub with water at chest height, arms crossed', figure: f({ uArmL: 130, lArmL: 20, uArmR: 50, lArmR: 160, thighL: 93, shinL: 90, thighR: 87, shinR: 90 }), props: [{ type: 'tub', x: 22, y: 90, w: 56 }, { type: 'water', y: 45 }, { type: 'floor' }] },
  sauna: { id: 'sauna', label: 'Person sitting relaxed on a sauna bench with heat rising', figure: f({ hip: [44, 73], torso: -95, uArmL: 75, lArmL: 35, uArmR: 70, lArmR: 30, thighL: 2, shinL: 88, thighR: -2, shinR: 92 }), props: [{ type: 'bench', x: 30, y: 74, w: 40 }, { type: 'heat', x: 14, y: 48 }, { type: 'heat', x: 76, y: 48 }, { type: 'floor' }] },
  stamina: { id: 'stamina', label: 'Person hiking with a long stride under the sun, arms swinging', figure: f({ hip: [48, 59], torso: -80, head: -80, uArmL: 130, lArmL: 100, uArmR: 40, lArmR: -10, thighL: 125, shinL: 110, thighR: 55, shinR: 95 }), props: [{ type: 'sun' }, { type: 'floor' }] },
  swim: { id: 'swim', label: 'Person swimming freestyle, one arm reaching forward and one recovering', figure: f({ hip: [56, 62], torso: 175, head: 230, uArmL: 185, lArmL: 185, uArmR: 0, lArmR: -30, thighL: 5, shinL: 20, thighR: -10, shinR: 5 }), props: [{ type: 'water', y: 62 }] },
  yoga: { id: 'yoga', label: 'Person in a warrior yoga pose: wide stance, front knee bent, arms out horizontal', figure: f({ hip: [50, 66], uArmL: 180, lArmL: 180, uArmR: 0, lArmR: 0, thighL: 140, shinL: 130, thighR: 30, shinR: 90 }), props: FLOOR },

  // ---- Foundation (True-to-Form style) ----
  standingDecompression: { id: 'standingDecompression', label: 'Standing decompression: feet together, arms open wide at the sides, chest lifted', figure: f({ ...ARMS_OPEN, thighL: 92, shinL: 90, thighR: 88, shinR: 90 }), props: FLOOR },
  standingDecompressionArmsUp: { id: 'standingDecompressionArmsUp', label: 'Standing decompression: feet together, arms raised overhead in a V', figure: f({ ...ARMS_UP, thighL: 92, shinL: 90, thighR: 88, shinR: 90 }), props: FLOOR },
  lungeDecompression: { id: 'lungeDecompression', label: 'Lunge decompression: tall split stance, arms open wide', figure: f({ ...ARMS_OPEN, ...SPLIT }), props: FLOOR },
  lungeDecompressionArmsUp: { id: 'lungeDecompressionArmsUp', label: 'Lunge decompression: tall split stance, arms raised overhead', figure: f({ ...ARMS_UP, ...SPLIT }), props: FLOOR },
  woodpeckerStart: { id: 'woodpeckerStart', label: 'Woodpecker start: tall split stance, front knee soft, arms open at the sides', figure: f({ ...ARMS_OPEN, thighL: 115, shinL: 100, thighR: 65, shinR: 85 }), props: FLOOR },
  woodpecker: { id: 'woodpecker', label: 'Woodpecker: split stance, hips hinged back, torso at 45 degrees, arms reaching forward', figure: f({ hip: [40, 58], torso: -45, uArmL: -20, lArmL: -10, uArmR: -25, lArmR: -10, thighL: 105, shinL: 100, thighR: 60, shinR: 95 }), props: FLOOR },
  woodpeckerRotation: { id: 'woodpeckerRotation', label: 'Woodpecker rotation: weight on the front leg, hinged forward, arms reaching and rotating toward the front side', figure: f({ hip: [40, 58], torso: -45, uArmL: -10, lArmL: 0, uArmR: -30, lArmR: -15, thighL: 110, shinL: 100, thighR: 60, shinR: 95 }), props: [{ type: 'arrow', x: 80, y: 60, angle: -20 }, { type: 'floor' }] },
  internalLegTracing: { id: 'internalLegTracing', label: 'Internal leg tracing: lying on the back, one heel sliding up the other leg while the opposite hand presses the knee', figure: f({ hip: [48, 82], torso: 190, uArmL: 20, lArmL: -10, uArmR: -25, lArmR: -30, thighL: -80, shinL: 80, thighR: 0, shinR: 0 }), props: FLOOR },
  anchoredBridgeStart: { id: 'anchoredBridgeStart', label: 'Anchored bridge start: lying on the back, knees bent, feet flat, arms at the sides', figure: f({ ...SUPINE, ...KNEES_BENT }), props: FLOOR },
  anchoredBridge: { id: 'anchoredBridge', label: 'Anchored bridge: lying on the back with knees bent, hips lifted a few inches', figure: f({ ...SUPINE, hip: [46, 78], torso: 162, head: 180, uArmL: 15, lArmL: -5, uArmR: 18, lArmR: -8, thighL: -40, shinL: 85, thighR: -35, shinR: 90 }), props: FLOOR },
  anchoredBackExtension: { id: 'anchoredBackExtension', label: 'Anchored back extension: face down, chest lifted, elbows bent with hands by the shoulders, feet slightly up', figure: f({ hip: [50, 85], torso: 190, head: 200, uArmL: 25, lArmL: -110, uArmR: 20, lArmR: -110, thighL: 0, shinL: -8, thighR: 0, shinR: -12 }), props: FLOOR },
  kneelingDecompressionStart: { id: 'kneelingDecompressionStart', label: 'Kneeling decompression start: kneeling upright on a pad, arms at the sides', figure: f({ hip: [50, 72], thighL: 92, shinL: 180, thighR: 88, shinR: 180 }), props: [{ type: 'pad', x: 30, y: 91, w: 26 }, { type: 'floor' }] },
  kneelingDecompression: { id: 'kneelingDecompression', label: 'Kneeling decompression: hips hinged back, torso forward at 45 degrees, arms reaching forward', figure: f({ hip: [42, 74], torso: -45, uArmL: -12, lArmL: -2, uArmR: -18, lArmR: -6, thighL: 64, shinL: 180, thighR: 60, shinR: 180 }), props: [{ type: 'pad', x: 30, y: 91, w: 26 }, { type: 'floor' }] },
  supineDecompression: { id: 'supineDecompression', label: 'Supine decompression: lying flat on the back, arms at the sides, knees slightly bent and together', figure: f({ ...SUPINE, thighL: -12, shinL: 12, thighR: -10, shinR: 10 }), props: FLOOR },
  proneDecompression: { id: 'proneDecompression', label: 'Prone decompression: face down with arms forward on the floor and the head lifted slightly', figure: f({ hip: [58, 85], torso: 180, head: 220, uArmL: 178, lArmL: 178, uArmR: 176, lArmR: 178, thighL: 0, shinL: 0, thighR: 0, shinR: 0 }), props: FLOOR },
  founder: { id: 'founder', label: 'Founder: hips hinged back, arms reaching forward and up', figure: f({ hip: [40, 58], torso: -35, uArmL: -40, lArmL: -35, uArmR: -50, lArmR: -45, thighL: 100, shinL: 95, thighR: 70, shinR: 95 }), props: FLOOR },
  founderStart: { id: 'founderStart', label: 'Founder start: wide stance, arms open', figure: f({ uArmL: 140, lArmL: 150, uArmR: 40, lArmR: 30, thighL: 110, shinL: 100, thighR: 70, shinR: 80 }), props: FLOOR },
  founderHinge: { id: 'founderHinge', label: 'Founder: hips hinge back, chest wide', figure: f({ hip: [42, 58], torso: -55, uArmL: 150, lArmL: 160, uArmR: 20, lArmR: 10, thighL: 105, shinL: 95, thighR: 70, shinR: 90 }), props: FLOOR },
  integratedHingesStart: { id: 'integratedHingesStart', label: 'Integrated hinges start: standing tall with elbows bent and hands beside the ears', figure: f({ uArmL: 150, lArmL: -80, uArmR: 30, lArmR: -100, thighL: 95, shinL: 90, thighR: 85, shinR: 90 }), props: FLOOR },
  integratedHinges: { id: 'integratedHinges', label: 'Integrated hinges: hands beside the ears, hips hinged back, torso at 45 degrees', figure: f({ hip: [42, 57], torso: -45, uArmL: 195, lArmL: -35, uArmR: 75, lArmR: -55, thighL: 72, shinL: 95, thighR: 78, shinR: 92 }), props: FLOOR },

  // ---- seven-minute moves ----
  jumpingJacks: { id: 'jumpingJacks', label: 'Jumping jack: arms and legs spread wide', figure: f({ hip: [50, 59], uArmL: -135, lArmL: -100, uArmR: -45, lArmR: -80, thighL: 115, shinL: 110, thighR: 65, shinR: 70 }), props: FLOOR },
  wallSit: { id: 'wallSit', label: 'Wall sit: back flat on the wall, thighs parallel to the floor', figure: f({ hip: [37.5, 74], uArmL: 75, lArmL: 5, uArmR: 70, lArmR: 10, thighL: 2, shinL: 90, thighR: -2, shinR: 90 }), props: [{ type: 'wall', x: 35 }, { type: 'floor' }] },
  pushup: { id: 'pushup', label: 'Push-up at the bottom: body in one line, elbows bent, chest near the floor', figure: f({ hip: [56, 80], torso: 195, uArmL: 45, lArmL: 140, uArmR: 40, lArmR: 145, thighL: 10, shinL: 15, thighR: 8, shinR: 18 }), props: FLOOR },
  crunch: { id: 'crunch', label: 'Crunch: on the back with knees bent, shoulders curled up, arms reaching toward the knees', figure: f({ ...SUPINE, torso: 200, head: 220, uArmL: -30, lArmL: -15, uArmR: -35, lArmR: -18, ...KNEES_BENT }), props: FLOOR },
  stepUp: { id: 'stepUp', label: 'Step-up: one foot planted on top of a box, stepping up', figure: f({ uArmL: 110, lArmL: 80, uArmR: 40, lArmR: -10, thighL: 92, shinL: 90, thighR: -16, shinR: 77 }), props: [{ type: 'box', x: 62, y: 68, w: 28, h: 22 }, { type: 'floor' }] },
  squat: { id: 'squat', label: 'Squat: thighs parallel to the floor, arms reaching forward', figure: f({ hip: [42, 74], torso: -75, uArmL: 2, lArmL: 0, uArmR: -2, lArmR: 0, thighL: 2, shinL: 88, thighR: -2, shinR: 92 }), props: FLOOR },
  dip: { id: 'dip', label: 'Dip: hands on a bench behind, elbows bent, hips low, legs extended forward', figure: f({ hip: [46, 77], torso: -85, uArmL: 145, lArmL: -125, uArmR: 140, lArmR: -130, thighL: 18, shinL: 27, thighR: 20, shinR: 25 }), props: [{ type: 'bench', x: 6, y: 54, w: 26 }, { type: 'floor' }] },
  plank: { id: 'plank', label: 'Forearm plank: straight line from head to heels', figure: f({ hip: [56, 82], torso: 190, uArmL: 105, lArmL: 180, uArmR: 110, lArmR: 180, thighL: 9, shinL: 13, thighR: 10, shinR: 14 }), props: FLOOR },
  highKnees: { id: 'highKnees', label: 'High-knee run in place: one knee driven up high, arms pumping', figure: f({ torso: -85, head: -85, uArmL: 110, lArmL: 20, uArmR: 70, lArmR: -30, thighL: 92, shinL: 90, thighR: -10, shinR: 100 }), props: FLOOR },
  lunge: { id: 'lunge', label: 'Lunge: deep split with the back knee near the floor and the front shin vertical', figure: f({ hip: [46, 72], uArmL: 100, lArmL: 95, uArmR: 80, lArmR: 85, thighL: 120, shinL: 170, thighR: 0, shinR: 90 }), props: FLOOR },
  pushupRotation: { id: 'pushupRotation', label: 'Push-up with rotation: side plank on one straight arm, the other arm reaching up', figure: f({ hip: [50, 73], torso: 200, uArmL: 95, lArmL: 92, uArmR: -85, lArmR: -80, thighL: 22, shinL: 36, thighR: 20, shinR: 38 }), props: FLOOR },
  sidePlank: { id: 'sidePlank', label: 'Side plank on one forearm: body in one line, hips up, top arm raised', figure: f({ hip: [54, 84], torso: 200, uArmL: 110, lArmL: 180, uArmR: -80, lArmR: -85, thighL: 8, shinL: 12, thighR: 6, shinR: 14 }), props: FLOOR },
  burpee: { id: 'burpee', label: 'Burpee at the bottom: plank on straight arms', figure: f({ hip: [56, 71], torso: 200, uArmL: 94, lArmL: 86, uArmR: 92, lArmR: 88, thighL: 22, shinL: 45, thighR: 20, shinR: 47 }), props: FLOOR },
  clappingPushup: { id: 'clappingPushup', label: 'Clapping push-up: body in a plank line with hands off the floor, clapping under the chest', figure: f({ hip: [56, 71], torso: 200, uArmL: 75, lArmL: 45, uArmR: 65, lArmR: 55, thighL: 22, shinL: 45, thighR: 20, shinR: 47 }), props: FLOOR },
  kneeUp: { id: 'kneeUp', label: 'Knee-up: hanging from a bar with both knees tucked to the chest', figure: f({ hip: [47.9, 61.9], torso: -95, head: -110, uArmL: -72, lArmL: -70, uArmR: -68, lArmR: -70, thighL: -25, shinL: 105, thighR: -30, shinR: 100 }), props: [{ type: 'bar', x: 56, y: 15.5, w: 26 }, { type: 'floor' }] },
  lungeJump: { id: 'lungeJump', label: 'Lunge jump: legs split in the air, both feet off the floor', figure: f({ hip: [50, 52], uArmL: 140, lArmL: 100, uArmR: 20, lArmR: -60, thighL: 130, shinL: 150, thighR: 30, shinR: 100 }), props: FLOOR },
  squatJump: { id: 'squatJump', label: 'Squat jump: feet off the floor, arms reaching up', figure: f({ hip: [50, 50], ...ARMS_UP, thighL: 105, shinL: 75, thighR: 75, shinR: 105 }), props: FLOOR },
  jumpRope: { id: 'jumpRope', label: 'Jump rope mid-jump, rope passing under the feet', figure: f({ hip: [50, 50], uArmL: 150, lArmL: 130, uArmR: 30, lArmR: 50, thighL: 100, shinL: 80, thighR: 80, shinR: 100 }), props: [{ type: 'rope', x: 50, y: 116.2, w: 38, h: 72.5 }, { type: 'floor' }] },

  // ---- super-slow strength ----
  chestPress: { id: 'chestPress', label: 'Chest press: lying on a bench pressing a bar straight up', figure: f({ hip: [50, 64], torso: 180, uArmL: -84, lArmL: -90, uArmR: -86, lArmR: -90, thighL: 25, shinL: 85, thighR: 22, shinR: 88 }), props: [{ type: 'bench', x: 14, y: 70, w: 60 }, { type: 'bar', x: 29, y: 38.5, w: 26 }, { type: 'floor' }] },
  latPulldown: { id: 'latPulldown', label: 'Lat pulldown: seated, arms up gripping an overhead bar on a cable', figure: f({ hip: [46, 72], torso: -95, uArmL: -130, lArmL: -85, uArmR: -50, lArmR: -95, thighL: 2, shinL: 90, thighR: -2, shinR: 90 }), props: [{ type: 'box', x: 30, y: 72, w: 20, h: 18 }, { type: 'cable', x: 44, y: 28, toX: 44, toY: 4 }, { type: 'bar', x: 44, y: 28, w: 30 }, { type: 'floor' }] },
  legPress: { id: 'legPress', label: 'Leg press: reclined on a seat, pushing both feet against a plate', figure: f({ hip: [36, 70], torso: -130, uArmL: 62, lArmL: 22, uArmR: 60, lArmR: 20, thighL: -14, shinL: -2, thighR: -10, shinR: -5 }), props: [{ type: 'bar', x: 25, y: 65, w: 30, angle: 50 }, { type: 'pad', x: 24, y: 74, w: 24 }, { type: 'box', x: 70, y: 52, w: 8, h: 28 }, { type: 'floor' }] },
  deadlift: { id: 'deadlift', label: 'Deadlift: hip hinge with a flat back, holding a bar at the shins', figure: f({ hip: [40, 58], torso: -50, uArmL: 107, lArmL: 105, uArmR: 105, lArmR: 105, thighL: 78, shinL: 100, thighR: 76, shinR: 102 }), props: [{ type: 'bar', x: 47.5, y: 66.5, w: 14 }, { type: 'floor' }] },

  // ---- tabata / cardio ----
  kbSwing: { id: 'kbSwing', label: 'Kettlebell swing: hips hinged, arms straight, bell swinging forward to shoulder height', figure: f({ hip: [46, 57], torso: -70, uArmL: 2, lArmL: 0, uArmR: -2, lArmR: 0, thighL: 100, shinL: 95, thighR: 95, shinR: 92 }), props: [{ type: 'kettlebell', x: 82, y: 39 }, { type: 'floor' }] },
  sprint: { id: 'sprint', label: 'Sprint: running with a long stride and forward lean, front knee high, arms pumping', figure: f({ hip: [46, 58], torso: -70, head: -65, uArmL: 140, lArmL: 170, uArmR: 20, lArmR: -70, thighL: 115, shinL: 100, thighR: -10, shinR: 80 }), props: FLOOR },
  mountainClimber: { id: 'mountainClimber', label: 'Mountain climber: plank on straight arms with one knee driven under the chest', figure: f({ hip: [56, 71], torso: 200, uArmL: 94, lArmL: 86, uArmR: 92, lArmR: 88, thighL: 22, shinL: 45, thighR: 160, shinR: 50 }), props: FLOOR },
  legSwing: { id: 'legSwing', label: 'Leg swing: standing on one leg with a hand on the wall, the other leg swinging forward', figure: f({ uArmL: 100, lArmL: 95, uArmR: 20, lArmR: 10, thighL: 92, shinL: 90, thighR: 30, shinR: 40 }), props: [{ type: 'wall', x: 78 }, { type: 'floor' }] },
  marching: { id: 'marching', label: 'Marching in place: one knee lifted to hip height, arms swinging', figure: f({ uArmL: 120, lArmL: 110, uArmR: 50, lArmR: 30, thighL: 92, shinL: 90, thighR: -5, shinR: 90 }), props: FLOOR },
  stepBack: { id: 'stepBack', label: 'Step-back: one leg stepped back into a shallow lunge, hands on hips', figure: f({ hip: [50, 58], uArmL: 120, lArmL: 40, uArmR: 60, lArmR: 140, thighL: 120, shinL: 112, thighR: 78, shinR: 92 }), props: FLOOR },

  // ---- mobility rolls ----
  rollCalf: { id: 'rollCalf', label: 'Rolling the calf: seated with hands behind, one calf resting on a foam roller', figure: f({ hip: [40, 84], torso: -80, uArmL: 132, lArmL: 112, uArmR: 130, lArmR: 110, thighL: -50, shinL: 70, thighR: -5, shinR: -12 }), props: [{ type: 'roller', x: 68, y: 86.5 }, { type: 'floor' }] },
  rollHamstring: { id: 'rollHamstring', label: 'Rolling the hamstring: seated with hands behind, thigh resting on a foam roller', figure: f({ hip: [38, 83], torso: -70, uArmL: 142, lArmL: 112, uArmR: 140, lArmR: 110, thighL: -12, shinL: 5, thighR: -8, shinR: 0 }), props: [{ type: 'roller', x: 50, y: 86.5 }, { type: 'floor' }] },
  rollHip: { id: 'rollHip', label: 'Rolling the outer hip: side-lying on a forearm with the roller under the hip, top foot on the floor', figure: f({ hip: [50, 82], torso: 195, uArmL: 100, lArmL: 180, uArmR: 60, lArmR: 10, thighL: 5, shinL: 5, thighR: -30, shinR: 80 }), props: [{ type: 'roller', x: 50, y: 86.5 }, { type: 'floor' }] },
  rollITBand: { id: 'rollITBand', label: 'Rolling the IT band: side-lying on a forearm with the roller under the outer thigh, top foot crossed in front', figure: f({ hip: [48, 82], torso: 195, uArmL: 100, lArmL: 180, uArmR: 60, lArmR: 10, thighL: 5, shinL: 5, thighR: -25, shinR: 80 }), props: [{ type: 'roller', x: 60, y: 86.5 }, { type: 'floor' }] },
  rollAdductor: { id: 'rollAdductor', label: 'Rolling the adductor: face down on the forearms with one leg bent out to the side over the roller', figure: f({ hip: [50, 84], torso: 195, head: 200, uArmL: 105, lArmL: 180, uArmR: 100, lArmR: 180, thighL: 5, shinL: 3, thighR: -55, shinR: 60 }), props: [{ type: 'roller', x: 57, y: 86.5 }, { type: 'floor' }] },
  rollBack: { id: 'rollBack', label: 'Rolling the back: lying on the back with the roller under the mid-back, knees bent, arms hugging the chest', figure: f({ hip: [46, 84], torso: 198, head: 200, uArmL: 10, lArmL: -120, uArmR: 20, lArmR: -110, ...KNEES_BENT }), props: [{ type: 'roller', x: 36, y: 86.5 }, { type: 'floor' }] },
  rollShoulder: { id: 'rollShoulder', label: 'Rolling the shoulder: side-lying with the roller under the armpit and the bottom arm extended overhead', figure: f({ hip: [56, 84], torso: 185, head: 220, uArmL: 178, lArmL: 178, uArmR: 40, lArmR: 0, thighL: 3, shinL: 3, thighR: -20, shinR: 45 }), props: [{ type: 'roller', x: 34, y: 87.5 }, { type: 'floor' }] },
  rollNeck: { id: 'rollNeck', label: 'Rolling the neck: lying on the back with the roller under the neck, knees bent', figure: f({ ...SUPINE, hip: [50, 84], head: 190, ...KNEES_BENT }), props: [{ type: 'roller', x: 24, y: 87.5 }, { type: 'floor' }] },
  rollQuad: { id: 'rollQuad', label: 'Rolling the quads: face down on the forearms with the roller under the thighs', figure: f({ hip: [52, 80], torso: 195, head: 200, uArmL: 112, lArmL: 180, uArmR: 108, lArmR: 180, thighL: 5, shinL: 15, thighR: 3, shinR: 17 }), props: [{ type: 'roller', x: 61, y: 86.5 }, { type: 'floor' }] },
};

export function poseIds(): string[] {
  return Object.keys(poses);
}
