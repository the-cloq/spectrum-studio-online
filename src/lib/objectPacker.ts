// Object definition packing for ZX Spectrum export
import { BinaryPacker, getObjectTypeEnum, floatToFixed8 } from "./binaryPacker";
import { GameObject } from "@/types/spectrum";

// Object property flags (bitfield)
const OBJ_FLAG_HAS_SPEED = 1 << 0;
const OBJ_FLAG_HAS_JUMP_HEIGHT = 1 << 1;
const OBJ_FLAG_HAS_GRAVITY = 1 << 2;
const OBJ_FLAG_HAS_PATROL = 1 << 3;
const OBJ_FLAG_HAS_DAMAGE = 1 << 4;
const OBJ_FLAG_HAS_POINTS = 1 << 5;
const OBJ_FLAG_REQUIRED_EXIT = 1 << 6;
const OBJ_FLAG_HAS_AI = 1 << 7;

export interface PackedObjectDef {
  spriteId: number;      // Index to sprite bank
  type: number;          // ObjectType enum
  flags: number;         // Property flags bitfield
  properties: number[];  // Variable length based on flags
}

// Pack a single object definition
export function packObjectDefinition(obj: GameObject, spriteIndexMap: Map<string, number>): number[] {
  const packer = new BinaryPacker();
  
  // Byte 0: spriteId (index to sprite bank)
  const spriteIndex = spriteIndexMap.get(obj.spriteId || "") ?? 0;
  packer.writeByte(spriteIndex);
  
  // Byte 1: type enum
  const typeEnum = getObjectTypeEnum(obj.type);
  packer.writeByte(typeEnum);
  
  // Byte 2: property flags
  let flags = 0;
  const properties: number[] = [];
  
  // Player-specific properties
  if (obj.type === "player" && obj.properties) {
    if (typeof obj.properties.speed === "number") {
      flags |= OBJ_FLAG_HAS_SPEED;
      properties.push(floatToFixed8(obj.properties.speed));
    }
    if (typeof obj.properties.jumpHeight === "number") {
      flags |= OBJ_FLAG_HAS_JUMP_HEIGHT;
      properties.push(Math.round(obj.properties.jumpHeight));
    }
    if (typeof obj.properties.gravity === "number") {
      flags |= OBJ_FLAG_HAS_GRAVITY;
      properties.push(floatToFixed8(obj.properties.gravity));
    }
  }
  
  // Enemy-specific properties
  if (obj.type === "enemy" && obj.properties) {
    if (typeof obj.properties.speed === "number") {
      flags |= OBJ_FLAG_HAS_SPEED;
      properties.push(floatToFixed8(obj.properties.speed));
    }
    if (obj.properties.patrolType) {
      flags |= OBJ_FLAG_HAS_PATROL;
      // Encode patrol type: 0=horizontal, 1=vertical, 2=circular
      const patrolMap: Record<string, number> = {
        "horizontal": 0,
        "vertical": 1,
        "circular": 2,
      };
      properties.push(patrolMap[obj.properties.patrolType] ?? 0);
    }
    if (typeof obj.properties.damage === "number") {
      flags |= OBJ_FLAG_HAS_DAMAGE;
      properties.push(Math.round(obj.properties.damage));
    }
    if (obj.properties.aiBehavior) {
      flags |= OBJ_FLAG_HAS_AI;
      // Encode AI behavior: 0=patrol, 1=chase, 2=guard
      const aiMap: Record<string, number> = {
        "patrol": 0,
        "chase": 1,
        "guard": 2,
      };
      properties.push(aiMap[obj.properties.aiBehavior] ?? 0);
    }
  }
  
  // Collectable-specific properties
  if (obj.type === "collectable" && obj.properties) {
    if (typeof obj.properties.points === "number") {
      flags |= OBJ_FLAG_HAS_POINTS;
      // Store as 16-bit word
      const points = Math.round(obj.properties.points);
      properties.push(points & 0xff, (points >> 8) & 0xff);
    }
    if (obj.properties.requiredToExit) {
      flags |= OBJ_FLAG_REQUIRED_EXIT;
    }
  }
  
  packer.writeByte(flags);
  
  // Bytes 3+: variable properties based on flags
  packer.writeBytes(properties);
  
  return packer.getBytes();
}

// Pack all object definitions into a bank
export function packObjectBank(objects: GameObject[], spriteIndexMap: Map<string, number>): Uint8Array {
  const packer = new BinaryPacker();
  
  // Header: number of objects
  packer.writeByte(objects.length);
  
  // Pack each object definition
  for (const obj of objects) {
    const objBytes = packObjectDefinition(obj, spriteIndexMap);
    packer.writeBytes(objBytes);
  }
  
  return packer.toUint8Array();
}

// Generate assembly code for object bank
export function generateObjectBankAsm(objects: GameObject[], spriteIndexMap: Map<string, number>): string {
  const bytes = Array.from(packObjectBank(objects, spriteIndexMap));
  
  let asm = "; Object Definition Bank\n";
  asm += "; Format: [count] [obj0_data] [obj1_data] ...\n";
  asm += `; Total objects: ${objects.length}\n\n`;
  
  asm += "ObjectBank:\n";
  asm += `    defb ${objects.length}  ; Number of objects\n\n`;
  
  let offset = 1;
  for (let i = 0; i < objects.length; i++) {
    const objBytes = packObjectDefinition(objects[i], spriteIndexMap);
    asm += `; Object ${i}: ${objects[i].name} (${objects[i].type})\n`;
    asm += `Object${i}:\n`;
    asm += `    defb ${objBytes.join(",")}  ; spriteId, type, flags, properties...\n`;
    offset += objBytes.length;
  }
  
  return asm;
}
