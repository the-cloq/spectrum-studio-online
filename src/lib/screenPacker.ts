// Screen packing for ZX Spectrum export
import { BinaryPacker } from "./binaryPacker";
import { Screen, Block, GameObject, PlacedObject } from "@/types/spectrum";

// Instance override flags (bitfield)
const INST_FLAG_OVERRIDE_SPEED = 1 << 0;
const INST_FLAG_OVERRIDE_DIRECTION = 1 << 1;
const INST_FLAG_OVERRIDE_PATROL = 1 << 2;
const INST_FLAG_OVERRIDE_DAMAGE = 1 << 3;
const INST_FLAG_OVERRIDE_POINTS = 1 << 4;

// Pack a placed object instance
function packPlacedObject(
  obj: PlacedObject,
  objectIndexMap: Map<string, number>,
  defaultObject: GameObject | undefined
): number[] {
  const packer = new BinaryPacker();
  
  // Byte 0: objectId index
  const objIndex = objectIndexMap.get(obj.objectId) ?? 0;
  packer.writeByte(objIndex);
  
  // Byte 1-2: x, y position (in pixels or tiles depending on your coordinate system)
  packer.writeByte(Math.round(obj.x / 8)); // Convert to tile coordinates
  packer.writeByte(Math.round(obj.y / 8));
  
  // Byte 3: override flags
  let flags = 0;
  const overrides: number[] = [];
  
  // Check if instance has property overrides compared to defaults
  if (obj.propertyOverrides && defaultObject?.properties) {
    if (obj.propertyOverrides.speed !== undefined && obj.propertyOverrides.speed !== defaultObject.properties.speed) {
      flags |= INST_FLAG_OVERRIDE_SPEED;
      const speedByte = Math.round((obj.propertyOverrides.speed as number) * 4); // Fixed point
      overrides.push(speedByte & 0xff);
    }
    
    if (obj.propertyOverrides.startDirection && obj.propertyOverrides.startDirection !== defaultObject.properties.startDirection) {
      flags |= INST_FLAG_OVERRIDE_DIRECTION;
      const dirByte = obj.propertyOverrides.startDirection === "left" || obj.propertyOverrides.startDirection === "up" ? 0xff : 0x01;
      overrides.push(dirByte);
    }
    
    if (obj.propertyOverrides.damage !== undefined && obj.propertyOverrides.damage !== defaultObject.properties.damage) {
      flags |= INST_FLAG_OVERRIDE_DAMAGE;
      overrides.push(Math.round(obj.propertyOverrides.damage as number) & 0xff);
    }
    
    if (obj.propertyOverrides.points !== undefined && obj.propertyOverrides.points !== defaultObject.properties.points) {
      flags |= INST_FLAG_OVERRIDE_POINTS;
      const points = Math.round(obj.propertyOverrides.points as number);
      overrides.push(points & 0xff, (points >> 8) & 0xff);
    }
  }
  
  packer.writeByte(flags);
  
  // Bytes 4+: override values (only if flags set)
  if (overrides.length > 0) {
    packer.writeBytes(overrides);
  }
  
  return packer.getBytes();
}

// Pack a screen (tilemap + placed objects)
export function packScreen(
  screen: Screen,
  blockIndexMap: Map<string, number>,
  objectIndexMap: Map<string, number>,
  objects: GameObject[]
): Uint8Array {
  const packer = new BinaryPacker();
  
  // Header: screen dimensions
  packer.writeByte(screen.width);
  packer.writeByte(screen.height);
  
  // Tilemap data (width * height tile indices)
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const blockId = screen.tiles?.[y]?.[x] || "";
      const blockIndex = blockIndexMap.get(blockId) ?? 0;
      packer.writeByte(blockIndex);
    }
  }
  
  // Placed objects count
  const placedObjects = screen.placedObjects || [];
  packer.writeByte(placedObjects.length);
  
  // Pack each placed object
  for (const placedObj of placedObjects) {
    const defaultObject = objects.find(o => o.id === placedObj.objectId);
    const objBytes = packPlacedObject(placedObj, objectIndexMap, defaultObject);
    packer.writeBytes(objBytes);
  }
  
  return packer.toUint8Array();
}

// Pack all screens with pointer table
export function packScreenBank(
  screens: Screen[],
  blockIndexMap: Map<string, number>,
  objectIndexMap: Map<string, number>,
  objects: GameObject[]
): Uint8Array {
  const packer = new BinaryPacker();
  
  // Build pointer table and data
  const pointerTable: number[] = [];
  const screenDataArrays: Uint8Array[] = [];
  
  let dataOffset = screens.length * 2; // Pointer table size (2 bytes per screen)
  
  for (const screen of screens) {
    // Add pointer (offset from start of data section)
    pointerTable.push(dataOffset & 0xff, (dataOffset >> 8) & 0xff);
    
    // Pack screen data
    const screenData = packScreen(screen, blockIndexMap, objectIndexMap, objects);
    screenDataArrays.push(screenData);
    dataOffset += screenData.length;
  }
  
  // Write pointer table
  packer.writeBytes(pointerTable);
  
  // Write all screen data
  for (const screenData of screenDataArrays) {
    packer.writeBytes(Array.from(screenData));
  }
  
  return packer.toUint8Array();
}

// Generate assembly code for screen bank
export function generateScreenBankAsm(
  screens: Screen[],
  blockIndexMap: Map<string, number>,
  objectIndexMap: Map<string, number>,
  objects: GameObject[]
): string {
  let asm = "; Screen Data Bank\n";
  asm += "; Format: [pointer_table] [screen0_data] [screen1_data] ...\n";
  asm += `; Total screens: ${screens.length}\n\n`;
  
  asm += "ScreenBank:\n";
  asm += "; Pointer table (offsets to screen data)\n";
  asm += "ScreenPtrTable:\n";
  
  let dataOffset = screens.length * 2;
  for (let i = 0; i < screens.length; i++) {
    const screenData = packScreen(screens[i], blockIndexMap, objectIndexMap, objects);
    asm += `    defw Screen${i}Data - ScreenBank  ; Offset to screen ${i}\n`;
    dataOffset += screenData.length;
  }
  
  asm += "\n; Screen data\n";
  for (let i = 0; i < screens.length; i++) {
    const screenData = Array.from(packScreen(screens[i], blockIndexMap, objectIndexMap, objects));
    asm += `\nScreen${i}Data:  ; ${screens[i].name}\n`;
    asm += `    defb ${screens[i].width},${screens[i].height}  ; Dimensions\n`;
    
    // Write tilemap data in rows
    const tilemapSize = screens[i].width * screens[i].height;
    const tilemapBytes = screenData.slice(2, 2 + tilemapSize);
    asm += `    ; Tilemap (${screens[i].width}x${screens[i].height} tiles)\n`;
    for (let row = 0; row < screens[i].height; row++) {
      const rowStart = row * screens[i].width;
      const rowBytes = tilemapBytes.slice(rowStart, rowStart + screens[i].width);
      asm += `    defb ${rowBytes.join(",")}  ; Row ${row}\n`;
    }
    
    // Write placed objects
    const objectsCount = screenData[2 + tilemapSize];
    asm += `    defb ${objectsCount}  ; Number of placed objects\n`;
    if (objectsCount > 0) {
      const objectsData = screenData.slice(2 + tilemapSize + 1);
      asm += `    defb ${objectsData.join(",")}  ; Object instances\n`;
    }
  }
  
  return asm;
}
