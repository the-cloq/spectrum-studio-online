// ZX Spectrum game designer types

export type SpectrumColor = {
  name: string;
  value: string;
  ink: number; // 0-7 for standard colors
  bright: boolean;
};

export type SpriteSize = "8x8" | "16x16" | "24x12" | "32x16";

export type ObjectType = "player" | "enemy" | "ammunition" | "collectable" | "door" | "exit" | "moving-platform";

export type MovingPlatformType = "horizontal" | "vertical" | "elevator" | "rope";

export type BlockType =
  | "empty"
  | "solid"
  | "deadly"
  | "collectible"
  | "platform"
  | "sinking"
  | "crumbling"
  | "conveyor-left"
  | "conveyor-right";

export type SpriteFrame = {
  pixels: number[][];
};

export type Sprite = {
  id: string;
  name: string;
  size: SpriteSize;
  frames: SpriteFrame[];
  animationSpeed: number; // fps (1-12)
  preview?: string; // Base64 data URL for preview
  collisionBox?: {
    width: number; // Visible sprite width for collision (pixels)
    height: number; // Visible sprite height for collision (pixels)
    offsetTop: number; // Offset from top edge (pixels)
    offsetBottom: number; // Offset from bottom edge (pixels)
    offsetLeft: number; // Offset from left edge (pixels)
    offsetRight: number; // Offset from right edge (pixels)
  };
};

export type AnimationSet = {
  moveLeft?: string; // sprite ID
  moveRight?: string;
  moveUp?: string;
  moveDown?: string;
  idle?: string;
  jumpLeft?: string;
  jumpRight?: string;
  fire?: string;
};

export type GameObject = {
  id: string;
  name: string;
  type: ObjectType;
  spriteId: string; // Primary sprite reference
  animations?: AnimationSet; // Directional animations
  properties: {
    // Player properties
    speed?: number;
    jumpHeight?: number;
    jumpDistance?: number;
    gravity?: number;
    maxFallDistance?: number;
    
    // Enemy properties
    damage?: number;
    movementPattern?: "stationary" | "patrol" | "chase" | "fly";
    respawnDelay?: number;
    direction?: "left" | "right" | "up" | "down";
    
    // Ammunition properties
    projectileSpeed?: number;
    projectileDamage?: number;
    projectileRange?: number;
    
    // Collectable properties
    points?: number;
    energyBonus?: number;
    itemType?: "coin" | "key" | "powerup" | "life";
    oneTime?: boolean;
    
    // Door properties
    targetRoom?: string;
    targetFloor?: number;
    
    // Exit properties
    targetLevel?: string;
    activationConditions?: string;
    
    // Moving Platform properties
    platformType?: MovingPlatformType;
    platformSpeed?: number; // 1-8 pixels per frame
    platformRange?: number; // 1-16 blocks
    pauseAtEnds?: number; // 0-2000 ms
    startDirection?: "left" | "right" | "up" | "down";
    repeatType?: "ping-pong" | "loop";
    playerCarry?: boolean;
    elevatorStops?: number[]; // For elevator type
  };
};

export type Block = {
  id: string;
  name: string;
  sprite: Sprite;
  type: BlockType;
  properties: {
    deadly?: boolean;
    collectible?: boolean;
    points?: number;
    energy?: number;
    solid?: boolean;
  };
};

export type PlacedObject = {
  id: string;
  objectId: string;
  x: number;
  y: number;
  direction: "left" | "right";
};

export type Screen = {
  id: string;
  name: string;
  type: "title" | "game" | "loading"; // Screen type
  tiles?: string[][]; // 2D array of block IDs (for game screens)
  pixels?: SpectrumColor[][]; // 2D array of colors (for title/loading screens)
  placedObjects?: PlacedObject[]; // Placed game objects
  width: number;
  height: number;
};

export type Level = {
  id: string;
  name: string;
  screenIds: string[];
};

export type GameProject = {
  id: string;
  name: string;
  sprites: Sprite[];
  objects: GameObject[]; // New object library
  blocks: Block[];
  screens: Screen[];
  levels: Level[];
  settings: {
    lives: number;
    startEnergy: number;
    showScore: boolean;
    showEnergy: boolean;
  };
};

export const SPECTRUM_COLORS: SpectrumColor[] = [
  { name: "Black", value: "#000000", ink: 0, bright: false },
  { name: "Blue", value: "#0000D7", ink: 1, bright: false },
  { name: "Red", value: "#D70000", ink: 2, bright: false },
  { name: "Magenta", value: "#D700D7", ink: 3, bright: false },
  { name: "Green", value: "#00D700", ink: 4, bright: false },
  { name: "Cyan", value: "#00D7D7", ink: 5, bright: false },
  { name: "Yellow", value: "#D7D700", ink: 6, bright: false },
  { name: "White", value: "#D7D7D7", ink: 7, bright: false },
  { name: "Bright Black", value: "#000000", ink: 0, bright: true },
  { name: "Bright Blue", value: "#0000FF", ink: 1, bright: true },
  { name: "Bright Red", value: "#FF0000", ink: 2, bright: true },
  { name: "Bright Magenta", value: "#FF00FF", ink: 3, bright: true },
  { name: "Bright Green", value: "#00FF00", ink: 4, bright: true },
  { name: "Bright Cyan", value: "#00FFFF", ink: 5, bright: true },
  { name: "Bright Yellow", value: "#FFFF00", ink: 6, bright: true },
  { name: "Bright White", value: "#FFFFFF", ink: 7, bright: true },
];
