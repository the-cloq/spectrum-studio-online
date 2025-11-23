// ZX Spectrum game designer types

export type SpectrumColor = {
  name: string;
  value: string;
  ink: number; // 0-7 for standard colors
  bright: boolean;
};

export type SpriteSize = "8x8" | "16x16" | "24x12" | "32x16";

export type ObjectType = "player" | "enemy" | "collectible" | "static";

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
};

export type GameObject = {
  id: string;
  name: string;
  type: ObjectType;
  spriteId: string; // References a sprite instead of embedding it
  properties: {
    // Player properties
    speed?: number;
    jumpHeight?: number;
    maxEnergy?: number;
    
    // Enemy properties
    damage?: number;
    movementPattern?: "stationary" | "patrol" | "chase" | "fly";
    patrolDistance?: number;
    patrolSpeed?: number;
    
    // Collectible properties
    points?: number;
    energyBonus?: number;
    itemType?: "coin" | "key" | "powerup" | "life";
    
    // Static properties
    blocking?: boolean;
    deadly?: boolean;
    interactable?: boolean;
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

export type Screen = {
  id: string;
  name: string;
  type: "title" | "game"; // Screen type
  tiles?: string[][]; // 2D array of block IDs (for game screens)
  pixels?: SpectrumColor[][]; // 2D array of colors (for title screens)
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
