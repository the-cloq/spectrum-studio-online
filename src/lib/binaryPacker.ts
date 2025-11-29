// Binary packing utilities for ZX Spectrum export
// Follows compact encoding patterns with indices, bitfields, and fixed-point

export class BinaryPacker {
  private bytes: number[] = [];

  // Write a single byte (0-255)
  writeByte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  // Write a signed byte (-128 to 127)
  writeSignedByte(value: number): void {
    const byte = value < 0 ? (256 + value) : value;
    this.bytes.push(byte & 0xff);
  }

  // Write a 16-bit word (little-endian)
  writeWord(value: number): void {
    this.bytes.push(value & 0xff);
    this.bytes.push((value >> 8) & 0xff);
  }

  // Write multiple bytes
  writeBytes(values: number[]): void {
    this.bytes.push(...values.map(v => v & 0xff));
  }

  // Get the packed bytes
  getBytes(): number[] {
    return this.bytes;
  }

  // Get as Uint8Array
  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  // Clear the buffer
  clear(): void {
    this.bytes = [];
  }

  // Get current size
  size(): number {
    return this.bytes.length;
  }
}

// Convert bytes to assembly defb lines
export function bytesToAsmDefb(bytes: number[], label: string, bytesPerLine = 16): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const slice = bytes.slice(i, i + bytesPerLine);
    chunks.push(`    defb ${slice.map(n => n.toString()).join(",")}`);
  }
  return `${label}:\n${chunks.join("\n")}\n`;
}

// Convert bytes to assembly defw lines (for 16-bit words)
export function bytesToAsmDefw(words: number[], label: string, wordsPerLine = 8): string {
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    const slice = words.slice(i, i + wordsPerLine);
    chunks.push(`    defw ${slice.map(n => n.toString()).join(",")}`);
  }
  return `${label}:\n${chunks.join("\n")}\n`;
}

// Fixed-point conversion (pixels/frame * 4 for 1/4 pixel resolution)
export function floatToFixed8(value: number, scale = 4): number {
  const fixed = Math.round(value * scale);
  // Clamp to signed 8-bit range (-128 to 127)
  return Math.max(-128, Math.min(127, fixed));
}

// Convert direction string to signed byte
export function directionToByte(direction: "left" | "right" | "up" | "down"): number {
  switch (direction) {
    case "left": return -1 & 0xff;
    case "right": return 1;
    case "up": return -1 & 0xff;
    case "down": return 1;
    default: return 0;
  }
}

// Block type enum mapping
export enum BlockType {
  SOLID = 0,
  DEADLY = 1,
  CONVEYOR = 2,
  CRUMBLING = 3,
  SINKING = 4,
  ICE = 5,
  LADDER = 6,
}

// Object type enum mapping
export enum ObjectTypeEnum {
  PLAYER = 0,
  ENEMY = 1,
  COLLECTIBLE = 2,
  DOOR = 3,
  EXIT = 4,
  MOVING_PLATFORM = 5,
  AMMUNITION = 6,
}

// Get block type enum from string
export function getBlockTypeEnum(type: string): number {
  const typeMap: Record<string, number> = {
    "solid": BlockType.SOLID,
    "deadly": BlockType.DEADLY,
    "conveyor": BlockType.CONVEYOR,
    "crumbling": BlockType.CRUMBLING,
    "sinking": BlockType.SINKING,
    "ice": BlockType.ICE,
    "slippery": BlockType.ICE,
    "ladder": BlockType.LADDER,
  };
  return typeMap[type.toLowerCase()] ?? BlockType.SOLID;
}

// Get object type enum from string
export function getObjectTypeEnum(type: string): number {
  const typeMap: Record<string, number> = {
    "player": ObjectTypeEnum.PLAYER,
    "enemy": ObjectTypeEnum.ENEMY,
    "collectible": ObjectTypeEnum.COLLECTIBLE,
    "door": ObjectTypeEnum.DOOR,
    "exit": ObjectTypeEnum.EXIT,
    "moving_platform": ObjectTypeEnum.MOVING_PLATFORM,
    "ammunition": ObjectTypeEnum.AMMUNITION,
  };
  return typeMap[type.toLowerCase()] ?? ObjectTypeEnum.COLLECTIBLE;
}
