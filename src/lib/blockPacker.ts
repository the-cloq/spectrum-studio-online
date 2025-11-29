// Block definition packing for ZX Spectrum export
import { BinaryPacker, getBlockTypeEnum, floatToFixed8, directionToByte } from "./binaryPacker";
import { Block } from "@/types/spectrum";

// Block property flags (bitfield)
const BLOCK_FLAG_HAS_SPEED = 1 << 0;
const BLOCK_FLAG_HAS_DIRECTION = 1 << 1;
const BLOCK_FLAG_HAS_CRUMBLE_TIME = 1 << 2;
const BLOCK_FLAG_HAS_RESPAWN_TIME = 1 << 3;
const BLOCK_FLAG_HAS_FRICTION = 1 << 4;
const BLOCK_FLAG_HAS_DEPTH = 1 << 5;
const BLOCK_FLAG_HAS_CLIMB_SPEED = 1 << 6;
const BLOCK_FLAG_PASS_THROUGH = 1 << 7;

export interface PackedBlockDef {
  spriteId: number;      // Index to sprite bank
  type: number;          // BlockType enum
  flags: number;         // Property flags bitfield
  properties: number[];  // Variable length based on flags
}

// Pack a single block definition
export function packBlockDefinition(block: Block, spriteIndexMap: Map<string, number>): number[] {
  const packer = new BinaryPacker();
  
  // Byte 0: spriteId (index to sprite bank)
  const spriteIndex = spriteIndexMap.get(block.sprite?.id || "") ?? 0;
  packer.writeByte(spriteIndex);
  
  // Byte 1: type enum
  const typeEnum = getBlockTypeEnum(block.type);
  packer.writeByte(typeEnum);
  
  // Byte 2: property flags
  let flags = 0;
  const properties: number[] = [];
  
  // Check which properties this block type has
  if (block.type === "conveyor" && block.properties) {
    if (typeof block.properties.speed === "number") {
      flags |= BLOCK_FLAG_HAS_SPEED;
      properties.push(floatToFixed8(block.properties.speed));
    }
    if (block.properties.direction) {
      flags |= BLOCK_FLAG_HAS_DIRECTION;
      properties.push(directionToByte(block.properties.direction as "left" | "right" | "up" | "down"));
    }
  }
  
  if (block.type === "crumbling" && block.properties) {
    if (typeof block.properties.crumbleTime === "number") {
      flags |= BLOCK_FLAG_HAS_CRUMBLE_TIME;
      properties.push(Math.round(block.properties.crumbleTime * 12)); // Convert seconds to frames (12fps)
    }
    if (typeof block.properties.respawnTime === "number") {
      flags |= BLOCK_FLAG_HAS_RESPAWN_TIME;
      // Store as word (16-bit) for longer respawn times
      const respawnFrames = Math.round(block.properties.respawnTime * 12);
      properties.push(respawnFrames & 0xff, (respawnFrames >> 8) & 0xff);
    }
  }
  
  if (block.type === "sinking" && block.properties) {
    if (typeof block.properties.sinkingSpeed === "number") {
      flags |= BLOCK_FLAG_HAS_SPEED;
      properties.push(floatToFixed8(block.properties.sinkingSpeed));
    }
    if (typeof block.properties.sinkingDepth === "number") {
      flags |= BLOCK_FLAG_HAS_DEPTH;
      properties.push(Math.round(block.properties.sinkingDepth));
    }
  }
  
  if (block.type === "ice" && block.properties) {
    if (typeof block.properties.frictionCoefficient === "number") {
      flags |= BLOCK_FLAG_HAS_FRICTION;
      // Store friction as 0-255 (multiply by 256)
      properties.push(Math.round(block.properties.frictionCoefficient * 256));
    }
  }
  
  if (block.type === "ladder" && block.properties) {
    if (typeof block.properties.climbSpeed === "number") {
      flags |= BLOCK_FLAG_HAS_CLIMB_SPEED;
      properties.push(floatToFixed8(block.properties.climbSpeed));
    }
    if (block.properties.passThroughAllowed) {
      flags |= BLOCK_FLAG_PASS_THROUGH;
    }
  }
  
  packer.writeByte(flags);
  
  // Bytes 3+: variable properties based on flags
  packer.writeBytes(properties);
  
  return packer.getBytes();
}

// Pack all block definitions into a bank
export function packBlockBank(blocks: Block[], spriteIndexMap: Map<string, number>): Uint8Array {
  const packer = new BinaryPacker();
  
  // Header: number of blocks
  packer.writeByte(blocks.length);
  
  // Pack each block definition
  for (const block of blocks) {
    const blockBytes = packBlockDefinition(block, spriteIndexMap);
    packer.writeBytes(blockBytes);
  }
  
  return packer.toUint8Array();
}

// Generate assembly code for block bank
export function generateBlockBankAsm(blocks: Block[], spriteIndexMap: Map<string, number>): string {
  const bytes = Array.from(packBlockBank(blocks, spriteIndexMap));
  
  let asm = "; Block Definition Bank\n";
  asm += "; Format: [count] [block0_data] [block1_data] ...\n";
  asm += `; Total blocks: ${blocks.length}\n\n`;
  
  asm += "BlockBank:\n";
  asm += `    defb ${blocks.length}  ; Number of blocks\n\n`;
  
  let offset = 1;
  for (let i = 0; i < blocks.length; i++) {
    const blockBytes = packBlockDefinition(blocks[i], spriteIndexMap);
    asm += `; Block ${i}: ${blocks[i].name} (${blocks[i].type})\n`;
    asm += `Block${i}:\n`;
    asm += `    defb ${blockBytes.join(",")}  ; spriteId, type, flags, properties...\n`;
    offset += blockBytes.length;
  }
  
  return asm;
}
