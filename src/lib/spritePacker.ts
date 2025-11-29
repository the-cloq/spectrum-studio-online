// Sprite packing for ZX Spectrum export
import { BinaryPacker, bytesToAsmDefb, bytesToAsmDefw } from "./binaryPacker";
import { Sprite } from "@/types/spectrum";

// Parse sprite dimensions from size string
function getSpriteDimensions(size: string): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number);
  return { width: w || 16, height: h || 16 };
}

// Pack sprite pixel data (8x8 or 16x16 ZX Spectrum format)
function packSpritePixels(sprite: Sprite, frameIndex = 0): number[] {
  const pixels: number[] = [];
  const { width, height } = getSpriteDimensions(sprite.size);
  const framePixels = sprite.frames[frameIndex]?.pixels || [];
  
  // Convert pixel grid to ZX Spectrum bitmap format
  // framePixels is a 2D array [row][col] where each value is a color index (0-15)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 8) {
      let byte = 0;
      // Pack 8 pixels into one byte
      for (let bit = 0; bit < 8 && (x + bit) < width; bit++) {
        const pixelX = x + bit;
        const color = framePixels[y]?.[pixelX] || 0;
        // Set bit if pixel is non-zero (foreground)
        if (color !== 0) {
          byte |= (1 << (7 - bit));
        }
      }
      pixels.push(byte);
    }
  }
  
  return pixels;
}

// Pack collision box (Sprite has one collision box, not per-frame)
function packCollisionBox(sprite: Sprite): number[] {
  const { width, height } = getSpriteDimensions(sprite.size);
  const box = sprite.collisionBox;
  
  if (!box) {
    // Default collision box covers entire sprite
    return [0, height, 0, width];
  }
  
  // 4 bytes: offsetTop, offsetBottom, offsetLeft, offsetRight
  return [
    box.offsetTop & 0xff,
    box.offsetBottom & 0xff,
    box.offsetLeft & 0xff,
    box.offsetRight & 0xff,
  ];
}

// Pack a single sprite definition with frames and collision data
function packSprite(sprite: Sprite, spriteIndex: number): {
  pixelData: number[];
  collisionData: number[];
  metadata: number[];
} {
  const packer = new BinaryPacker();
  
  // Metadata: sprite dimensions and frame count
  const { width, height } = getSpriteDimensions(sprite.size);
  const frameCount = sprite.frames?.length || 1;
  
  const metadata = [
    spriteIndex & 0xff,
    width & 0xff,
    height & 0xff,
    frameCount & 0xff,
    sprite.animationSpeed & 0xff,
  ];
  
  // Pixel data for all frames
  const pixelData: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    pixelData.push(...packSpritePixels(sprite, i));
  }
  
  // Collision box (one per sprite, not per frame)
  const collisionData = packCollisionBox(sprite);
  
  return { pixelData, collisionData, metadata };
}

// Pack all sprites with pointer tables
export function packSpriteBank(sprites: Sprite[]): Uint8Array {
  const packer = new BinaryPacker();
  
  // Build sprite index map
  const spriteIndexMap = new Map<string, number>();
  sprites.forEach((sprite, index) => {
    spriteIndexMap.set(sprite.id, index);
  });
  
  // Collect all sprite data
  const spriteDataList: {
    pixelData: number[];
    collisionData: number[];
    metadata: number[];
  }[] = [];
  
  for (let i = 0; i < sprites.length; i++) {
    spriteDataList.push(packSprite(sprites[i], i));
  }
  
  // Build pointer tables
  // 3 tables: metadata pointers, pixel data pointers, collision data pointers
  const metadataPtrs: number[] = [];
  const pixelPtrs: number[] = [];
  const collisionPtrs: number[] = [];
  
  // Calculate base offset (after all pointer tables)
  const ptrTableSize = sprites.length * 2 * 3; // 3 tables, 2 bytes per pointer
  let metadataOffset = ptrTableSize;
  let pixelOffset = metadataOffset;
  let collisionOffset = metadataOffset;
  
  // First pass: calculate offsets for metadata
  for (const spriteData of spriteDataList) {
    metadataPtrs.push(metadataOffset & 0xff, (metadataOffset >> 8) & 0xff);
    metadataOffset += spriteData.metadata.length;
  }
  
  // Update pixel offset to start after metadata
  pixelOffset = metadataOffset;
  
  // Second pass: calculate offsets for pixel data
  for (const spriteData of spriteDataList) {
    pixelPtrs.push(pixelOffset & 0xff, (pixelOffset >> 8) & 0xff);
    pixelOffset += spriteData.pixelData.length;
  }
  
  // Update collision offset to start after pixels
  collisionOffset = pixelOffset;
  
  // Third pass: calculate offsets for collision data
  for (const spriteData of spriteDataList) {
    collisionPtrs.push(collisionOffset & 0xff, (collisionOffset >> 8) & 0xff);
    collisionOffset += spriteData.collisionData.length;
  }
  
  // Write pointer tables
  packer.writeBytes(metadataPtrs);
  packer.writeBytes(pixelPtrs);
  packer.writeBytes(collisionPtrs);
  
  // Write all metadata
  for (const spriteData of spriteDataList) {
    packer.writeBytes(spriteData.metadata);
  }
  
  // Write all pixel data
  for (const spriteData of spriteDataList) {
    packer.writeBytes(spriteData.pixelData);
  }
  
  // Write all collision data
  for (const spriteData of spriteDataList) {
    packer.writeBytes(spriteData.collisionData);
  }
  
  return packer.toUint8Array();
}

// Generate assembly code for sprite bank
export function generateSpriteBankAsm(sprites: Sprite[]): string {
  let asm = "; Sprite Data Bank\n";
  asm += "; Format: [metadata_ptrs] [pixel_ptrs] [collision_ptrs] [metadata] [pixels] [collision]\n";
  asm += `; Total sprites: ${sprites.length}\n\n`;
  
  asm += "SpriteBank:\n";
  
  // Pointer tables
  asm += "; Metadata pointer table\n";
  asm += "SpriteMetadataPtrs:\n";
  for (let i = 0; i < sprites.length; i++) {
    asm += `    defw Sprite${i}Metadata - SpriteBank\n`;
  }
  
  asm += "\n; Pixel data pointer table\n";
  asm += "SpritePixelPtrs:\n";
  for (let i = 0; i < sprites.length; i++) {
    asm += `    defw Sprite${i}Pixels - SpriteBank\n`;
  }
  
  asm += "\n; Collision data pointer table\n";
  asm += "SpriteCollisionPtrs:\n";
  for (let i = 0; i < sprites.length; i++) {
    asm += `    defw Sprite${i}Collision - SpriteBank\n`;
  }
  
  // Metadata section
  asm += "\n; Sprite metadata\n";
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    const { width, height } = getSpriteDimensions(sprite.size);
    const frameCount = sprite.frames?.length || 1;
    
    asm += `\nSprite${i}Metadata:  ; ${sprite.name}\n`;
    asm += `    defb ${i},${width},${height},${frameCount},${sprite.animationSpeed}  ; index, w, h, frames, fps\n`;
  }
  
  // Pixel data section
  asm += "\n; Sprite pixel data\n";
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    const frameCount = sprite.frames?.length || 1;
    const allPixelData: number[] = [];
    
    for (let f = 0; f < frameCount; f++) {
      allPixelData.push(...packSpritePixels(sprite, f));
    }
    
    asm += `\nSprite${i}Pixels:  ; ${sprite.name}\n`;
    asm += bytesToAsmDefb(allPixelData, "");
  }
  
  // Collision data section
  asm += "\n; Sprite collision boxes (offsetTop, offsetBottom, offsetLeft, offsetRight)\n";
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    const collisionData = packCollisionBox(sprite);
    
    asm += `\nSprite${i}Collision:  ; ${sprite.name}\n`;
    asm += `    defb ${collisionData.join(",")}  ; offsetTop, offsetBottom, offsetLeft, offsetRight\n`;
  }
  
  return asm;
}

// Create sprite index map for other packers to reference
export function createSpriteIndexMap(sprites: Sprite[]): Map<string, number> {
  const map = new Map<string, number>();
  sprites.forEach((sprite, index) => {
    map.set(sprite.id, index);
  });
  return map;
}
