import { TAPGenerator } from "./tapGenerator";
import { type Screen, type GameFlowScreen, type Level, type Block, type GameObject, type Sprite, SPECTRUM_COLORS } from "@/types/spectrum";
import { packBlockBank, generateBlockBankAsm } from "./blockPacker";
import { packObjectBank, generateObjectBankAsm } from "./objectPacker";
import { packScreenBank, generateScreenBankAsm } from "./screenPacker";
import { packSpriteBank, generateSpriteBankAsm, createSpriteIndexMap } from "./spritePacker";

/**
 * Export Game Flow to TAP file with binary data banks
 * Includes loading screens, title screens, and level data using compact binary encoding
 */
export function exportGameFlowToTAP(
  gameFlow: GameFlowScreen[],
  screens: Screen[],
  levels: Level[],
  blocks: Block[],
  objects: GameObject[],
  sprites: Sprite[],
  projectName: string
): Blob {
  const tap = new TAPGenerator();

  // Sort game flow by order
  const sortedFlow = [...gameFlow].sort((a, b) => a.order - b.order);

  // Get all screens that have pixel data
  const validFlowScreens = sortedFlow
    .map(flow => {
      const screen = screens.find(s => s.id === flow.screenId);
      // For levels, find the level and get its first screen
      if (!screen) {
        const level = levels.find(l => l.id === flow.screenId);
        if (level && level.screenIds.length > 0) {
          return screens.find(s => s.id === level.screenIds[0]);
        }
      }
      return screen;
    })
    .filter((screen): screen is Screen => !!screen);

  if (validFlowScreens.length === 0) {
    return tap.toBlob();
  }

  // Use first valid screen as loading screen
  const loadingScreen = validFlowScreens[0];
  const loadingScr = encodeScreenToSCR(loadingScreen, blocks, objects, sprites);

  // Build index maps for binary encoding
  const spriteIndexMap = createSpriteIndexMap(sprites);
  const blockIndexMap = new Map<string, number>();
  blocks.forEach((block, index) => {
    blockIndexMap.set(block.id, index);
  });
  const objectIndexMap = new Map<string, number>();
  objects.forEach((obj, index) => {
    objectIndexMap.set(obj.id, index);
  });

  // Pack all data banks to binary format
  const spriteBank = packSpriteBank(sprites);
  const blockBank = packBlockBank(blocks, spriteIndexMap);
  const objectBank = packObjectBank(objects, spriteIndexMap);
  const screenBank = packScreenBank(screens, blockIndexMap, objectIndexMap, objects);

  // Calculate memory layout
  const engineStart = 32768;
  const spriteBankAddr = 40000;
  const blockBankAddr = spriteBankAddr + spriteBank.length;
  const objectBankAddr = blockBankAddr + blockBank.length;
  const screenBankAddr = objectBankAddr + objectBank.length;
  const bgScreenAddr = screenBankAddr + screenBank.length;

  // Build BASIC loader
  const basicProgram: number[] = [];

  // Line 10: CLEAR 32767
  basicProgram.push(0x00, 0x0a);
  let lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xfd, 0x20);
  basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x37);
  basicProgram.push(0x0e, 0x00, 0x00, 0xff, 0x7f, 0x00);
  basicProgram.push(0x0d);
  let lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 20: LOAD "" SCREEN$
  basicProgram.push(0x00, 0x14);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaa, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 30: LOAD "" CODE (sprite bank)
  basicProgram.push(0x00, 0x1e);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 40: LOAD "" CODE (block bank)
  basicProgram.push(0x00, 0x28);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 50: LOAD "" CODE (object bank)
  basicProgram.push(0x00, 0x32);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 60: LOAD "" CODE (screen bank)
  basicProgram.push(0x00, 0x3c);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 70: LOAD "" CODE (engine)
  basicProgram.push(0x00, 0x46);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 80: RANDOMIZE USR 32768
  basicProgram.push(0x00, 0x50);
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00);
  basicProgram.push(0xf9, 0x20, 0xc0, 0x20);
  basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x38);
  basicProgram.push(0x0e, 0x00, 0x00, 0x00, 0x80, 0x00);
  basicProgram.push(0x0d);
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Add BASIC program header and data
  const headerData: number[] = [0x00, 0x00];
  const filename = "Loader    ";
  for (let i = 0; i < 10; i++) {
    headerData.push(filename.charCodeAt(i));
  }
  headerData.push(basicProgram.length & 0xff);
  headerData.push((basicProgram.length >> 8) & 0xff);
  headerData.push(0x0a, 0x00);
  headerData.push(basicProgram.length & 0xff);
  headerData.push((basicProgram.length >> 8) & 0xff);

  tap.addBlock(headerData);
  tap.addBlock([0xff, ...basicProgram]);

  // Add loading screen as SCREEN$
  const loadingName = projectName.substring(0, 10).padEnd(10, " ");
  tap.addHeader(loadingName, 6912, 16384);
  tap.addDataBlock(loadingScr);

  // Add sprite bank
  tap.addHeader("SpriteBank", spriteBank.length, spriteBankAddr);
  tap.addDataBlock(Array.from(spriteBank));

  // Add block bank
  tap.addHeader("BlockBank ", blockBank.length, blockBankAddr);
  tap.addDataBlock(Array.from(blockBank));

  // Add object bank
  tap.addHeader("ObjectBank", objectBank.length, objectBankAddr);
  tap.addDataBlock(Array.from(objectBank));

  // Add screen bank
  tap.addHeader("ScreenBank", screenBank.length, screenBankAddr);
  tap.addDataBlock(Array.from(screenBank));

  // Build Z80 engine that reads binary tables
  const engine = createBinaryGameEngine(
    spriteBankAddr,
    blockBankAddr,
    objectBankAddr,
    screenBankAddr,
    bgScreenAddr,
    validFlowScreens[1] || validFlowScreens[0],
    blocks,
    objects,
    sprites
  );

  // Add engine code
  const codeName = "GameEngine";
  tap.addHeader(codeName, engine.length, engineStart);
  tap.addDataBlock(engine);

  return tap.toBlob();
}

/**
 * Create Z80 game engine that reads binary data banks
 */
function createBinaryGameEngine(
  spriteBankAddr: number,
  blockBankAddr: number,
  objectBankAddr: number,
  screenBankAddr: number,
  bgScreenAddr: number,
  targetScreen: Screen,
  blocks: Block[],
  objects: GameObject[],
  sprites: Sprite[]
): number[] {
  const engine: number[] = [];

  // Simple test engine: display a screen from binary data and enable keyboard movement
  // This is Phase 1+2 combined: static display + keyboard test

  // Load background screen (render target screen to SCR format for now)
  const bgScr = encodeScreenToSCR(targetScreen, blocks, objects, sprites);
  
  // Copy screen to display memory
  // LD HL, bgScreenAddr
  engine.push(0x21);
  const bgAddrIdx = engine.length;
  engine.push(0x00, 0x00); // placeholder

  // LD DE, 16384 (screen memory)
  engine.push(0x11, 0x00, 0x40);

  // LD BC, 6912
  engine.push(0x01, 0x00, 0x1b);
  
  // LDIR
  engine.push(0xed, 0xb0);

  // Force bright white ink on black paper
  engine.push(0x21, 0x00, 0x58); // LD HL, 22528
  engine.push(0x36, 0x47);       // LD (HL), 0x47
  engine.push(0x11, 0x01, 0x58); // LD DE, 22529
  engine.push(0x01, 0xff, 0x02); // LD BC, 767
  engine.push(0xed, 0xb0);       // LDIR

  // Initialize player position
  const playerXPixel = 128;
  const playerYPixel = 96;
  
  engine.push(0x21);
  const playerXAddrIdx = engine.length;
  engine.push(0x00, 0x00);
  engine.push(0x36, playerXPixel & 0xff);

  // Set border to black
  engine.push(0x3e, 0x00, 0xd3, 0xfe);

  // Main game loop
  const gameLoopAddr = 32768 + engine.length;

  // Read keyboard (Q/W keys)
  engine.push(0x01, 0xfe, 0xfb); // LD BC, 0xFBFE
  engine.push(0xed, 0x78);       // IN A, (C)
  
  // Check W key (move right)
  engine.push(0xcb, 0x4f);       // BIT 1, A
  const jrNoWPos = engine.length;
  engine.push(0x20, 0x00);       // JR NZ, check_q
  
  // W pressed - move right
  engine.push(0x21);
  const playerXReadIdx1 = engine.length;
  engine.push(0x00, 0x00);
  engine.push(0x7e);             // LD A, (HL)
  engine.push(0xc6, 0x08);       // ADD A, 8
  engine.push(0x77);             // LD (HL), A
  engine.push(0x3e, 0x02, 0xd3, 0xfe); // Border red
  
  const jrToDrawFromWPos = engine.length;
  engine.push(0x18, 0x00);       // JR draw_pixel
  
  // Check Q key (move left)
  const checkQPos = engine.length;
  engine.push(0xcb, 0x47);       // BIT 0, A
  const jrNoQPos = engine.length;
  engine.push(0x20, 0x00);       // JR NZ, no_key
  
  // Q pressed - move left
  engine.push(0x21);
  const playerXReadIdx2 = engine.length;
  engine.push(0x00, 0x00);
  engine.push(0x7e);             // LD A, (HL)
  engine.push(0xd6, 0x08);       // SUB 8
  engine.push(0x77);             // LD (HL), A
  engine.push(0x3e, 0x05, 0xd3, 0xfe); // Border cyan

  const noKeyPos = engine.length;
  const drawPixelPos = engine.length;
  
  // Draw pixel at player position
  engine.push(0x21);
  const playerXReadIdx3 = engine.length;
  engine.push(0x00, 0x00);
  engine.push(0x7e);             // LD A, (HL) - X position
  engine.push(0x4f);             // LD C, A

  // Calculate screen address for fixed Y
  engine.push(0x3e, playerYPixel & 0xff); // LD A, Y
  engine.push(0xe6, 0xc0);       // AND 192
  engine.push(0xcb, 0x3f);       // SRL A (3x)
  engine.push(0xcb, 0x3f);
  engine.push(0xcb, 0x3f);
  engine.push(0x67);             // LD H, A

  engine.push(0x3e, playerYPixel & 0xff);
  engine.push(0xe6, 0x07);       // AND 7
  engine.push(0xb4);             // OR H
  engine.push(0xc6, 0x40);       // ADD A, 0x40
  engine.push(0x67);             // LD H, A

  engine.push(0x3e, playerYPixel & 0xff);
  engine.push(0xe6, 0x38);       // AND 56
  engine.push(0xcb, 0x27);       // SLA A (2x)
  engine.push(0xcb, 0x27);
  engine.push(0x6f);             // LD L, A

  engine.push(0x79);             // LD A, C (X)
  engine.push(0xcb, 0x3f);       // SRL A (3x)
  engine.push(0xcb, 0x3f);
  engine.push(0xcb, 0x3f);
  engine.push(0x85);             // ADD A, L
  engine.push(0x6f);             // LD L, A

  // Draw white pixel
  engine.push(0x36, 0xff);       // LD (HL), 0xFF

  // Small delay
  engine.push(0x06, 0x1e);       // LD B, 30
  engine.push(0x10, 0xfe);       // DJNZ -2

  // Loop back
  let loopOffset = gameLoopAddr - (32768 + engine.length + 2);
  engine.push(0x18, loopOffset & 0xff);

  // Append background screen data
  const bgScreenDataAddr = 32768 + engine.length;
  engine.push(...bgScr);
  
  // Player X variable
  const playerXAddr = 32768 + engine.length;
  engine.push(playerXPixel & 0xff);

  // Patch all address placeholders
  engine[bgAddrIdx] = bgScreenDataAddr & 0xff;
  engine[bgAddrIdx + 1] = (bgScreenDataAddr >> 8) & 0xff;
  
  engine[playerXAddrIdx] = playerXAddr & 0xff;
  engine[playerXAddrIdx + 1] = (playerXAddr >> 8) & 0xff;
  
  engine[playerXReadIdx1] = playerXAddr & 0xff;
  engine[playerXReadIdx1 + 1] = (playerXAddr >> 8) & 0xff;
  
  engine[playerXReadIdx2] = playerXAddr & 0xff;
  engine[playerXReadIdx2 + 1] = (playerXAddr >> 8) & 0xff;
  
  engine[playerXReadIdx3] = playerXAddr & 0xff;
  engine[playerXReadIdx3 + 1] = (playerXAddr >> 8) & 0xff;

  // Patch JR offsets
  const checkQAddr = 32768 + checkQPos;
  const drawPixelAddr = 32768 + drawPixelPos;
  const noKeyAddr = 32768 + noKeyPos;

  let disp = checkQAddr - (32768 + jrNoWPos + 2);
  engine[jrNoWPos + 1] = disp & 0xff;

  disp = drawPixelAddr - (32768 + jrToDrawFromWPos + 2);
  engine[jrToDrawFromWPos + 1] = disp & 0xff;

  disp = noKeyAddr - (32768 + jrNoQPos + 2);
  engine[jrNoQPos + 1] = disp & 0xff;

  return engine;
}

/**
 * Export assembly file (.asm) with all data banks
 */
export function exportGameFlowToASM(
  gameFlow: GameFlowScreen[],
  screens: Screen[],
  levels: Level[],
  blocks: Block[],
  objects: GameObject[],
  sprites: Sprite[],
  projectName: string
): string {
  let asm = `; ${projectName} - ZX Spectrum Game Data\n`;
  asm += `; Generated binary data banks\n\n`;

  // Build index maps
  const spriteIndexMap = createSpriteIndexMap(sprites);
  const blockIndexMap = new Map<string, number>();
  blocks.forEach((block, index) => {
    blockIndexMap.set(block.id, index);
  });
  const objectIndexMap = new Map<string, number>();
  objects.forEach((obj, index) => {
    objectIndexMap.set(obj.id, index);
  });

  // Generate assembly for each bank
  asm += generateSpriteBankAsm(sprites);
  asm += "\n\n";
  asm += generateBlockBankAsm(blocks, spriteIndexMap);
  asm += "\n\n";
  asm += generateObjectBankAsm(objects, spriteIndexMap);
  asm += "\n\n";
  asm += generateScreenBankAsm(screens, blockIndexMap, objectIndexMap, objects);

  return asm;
}

/**
 * Export combined binary file (.bin) with all data banks
 */
export function exportGameFlowToBIN(
  gameFlow: GameFlowScreen[],
  screens: Screen[],
  levels: Level[],
  blocks: Block[],
  objects: GameObject[],
  sprites: Sprite[],
  projectName: string
): Blob {
  // Build index maps
  const spriteIndexMap = createSpriteIndexMap(sprites);
  const blockIndexMap = new Map<string, number>();
  blocks.forEach((block, index) => {
    blockIndexMap.set(block.id, index);
  });
  const objectIndexMap = new Map<string, number>();
  objects.forEach((obj, index) => {
    objectIndexMap.set(obj.id, index);
  });

  // Pack all banks
  const spriteBank = packSpriteBank(sprites);
  const blockBank = packBlockBank(blocks, spriteIndexMap);
  const objectBank = packObjectBank(objects, spriteIndexMap);
  const screenBank = packScreenBank(screens, blockIndexMap, objectIndexMap, objects);

  // Combine all banks into one binary
  const totalLength = spriteBank.length + blockBank.length + objectBank.length + screenBank.length;
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  combined.set(spriteBank, offset);
  offset += spriteBank.length;

  combined.set(blockBank, offset);
  offset += blockBank.length;

  combined.set(objectBank, offset);
  offset += objectBank.length;

  combined.set(screenBank, offset);

  return new Blob([combined], { type: "application/octet-stream" });
}

/**
 * Encode a screen to ZX Spectrum SCR format (6912 bytes)
 * Used for loading screens and temporary rendering
 */
function encodeScreenToSCR(screen: Screen, blocks: Block[], objects: GameObject[], sprites: Sprite[]): number[] {
  const scrData = new Array(6912).fill(0);

  // Handle tile-based screens (game levels)
  if (screen.tiles && !screen.pixels) {
    const pixels: (typeof SPECTRUM_COLORS[0])[][] = Array.from({ length: 192 }, () => 
      Array(256).fill(SPECTRUM_COLORS[0])
    );

    // Render tiles
    for (let ty = 0; ty < screen.tiles.length && ty < 24; ty++) {
      for (let tx = 0; tx < screen.tiles[ty].length && tx < 32; tx++) {
        const blockId = screen.tiles[ty][tx];
        if (!blockId) continue;

        const block = blocks.find(b => b.id === blockId);
        if (!block || !block.sprite.frames[0]) continue;

        const spritePixels = block.sprite.frames[0].pixels;
        
        for (let sy = 0; sy < 8 && sy < spritePixels.length; sy++) {
          for (let sx = 0; sx < 8 && sx < spritePixels[sy].length; sx++) {
            const py = ty * 8 + sy;
            const px = tx * 8 + sx;
            const colorIndex = spritePixels[sy][sx];
            if (py < 192 && px < 256) {
              pixels[py][px] = SPECTRUM_COLORS[colorIndex] || SPECTRUM_COLORS[0];
            }
          }
        }
      }
    }

    // Render placed objects
    if (screen.placedObjects) {
      for (const placedObj of screen.placedObjects) {
        const gameObject = objects.find(o => o.id === placedObj.objectId);
        if (!gameObject) continue;

        let spriteId = gameObject.spriteId;
        if (placedObj.direction === "left" && gameObject.animations?.moveLeft) {
          spriteId = gameObject.animations.moveLeft;
        } else if (placedObj.direction === "right" && gameObject.animations?.moveRight) {
          spriteId = gameObject.animations.moveRight;
        }

        const objectSprite = sprites.find(s => s.id === spriteId);
        if (!objectSprite || !objectSprite.frames[0]) continue;

        const objPixels = objectSprite.frames[0].pixels;
        
        for (let sy = 0; sy < objPixels.length; sy++) {
          for (let sx = 0; sx < objPixels[sy].length; sx++) {
            const py = placedObj.y * 8 + sy;
            const px = placedObj.x * 8 + sx;
            const colorIndex = objPixels[sy][sx];
            
            if (colorIndex !== 0 && py >= 0 && py < 192 && px >= 0 && px < 256) {
              pixels[py][px] = SPECTRUM_COLORS[colorIndex] || SPECTRUM_COLORS[0];
            }
          }
        }
      }
    }

    return encodePixelsToSCR(pixels);
  }

  if (!screen.pixels) return scrData;
  return encodePixelsToSCR(screen.pixels);
}

/**
 * Encode a pixel array to ZX Spectrum SCR format (6912 bytes)
 */
function encodePixelsToSCR(pixels: (typeof SPECTRUM_COLORS[0])[][]): number[] {
  const scrData = new Array(6912).fill(0);

  for (let by = 0; by < 192; by += 8) {
    for (let bx = 0; bx < 256; bx += 8) {
      const colors = new Set<string>();
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const px = bx + x;
          const py = by + y;
          if (py < 192 && px < 256 && pixels[py]?.[px]) {
            colors.add(pixels[py][px].value);
          }
        }
      }

      const blockColors = Array.from(colors);
      const inkColor = SPECTRUM_COLORS.find(c => c.value === blockColors[0]) || SPECTRUM_COLORS[0];
      const paperColor = SPECTRUM_COLORS.find(c => c.value === (blockColors[1] || blockColors[0])) || SPECTRUM_COLORS[7];

      const inkValue = inkColor.ink;
      const paperValue = paperColor.ink;
      const bright = inkColor.bright || paperColor.bright ? 1 : 0;
      const attrIndex = 6144 + (by / 8) * 32 + (bx / 8);
      scrData[attrIndex] = (bright << 6) | (paperValue << 3) | inkValue;

      for (let y = 0; y < 8; y++) {
        const py = by + y;
        const scanline = ((py & 0xC0) << 5) | ((py & 0x07) << 8) | ((py & 0x38) << 2) | (bx / 8);
        let byte = 0;

        for (let x = 0; x < 8; x++) {
          const px = bx + x;
          const color = pixels[py]?.[px];
          if (color && color.value === blockColors[0]) {
            byte |= (1 << (7 - x));
          }
        }
        scrData[scanline] = byte;
      }
    }
  }

  return scrData;
}

/**
 * Download helper for TAP files
 */
export function downloadGameFlowTAP(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".tap") ? filename : `${filename}.tap`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download helper for ASM files
 */
export function downloadGameFlowASM(asm: string, filename: string) {
  const blob = new Blob([asm], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".asm") ? filename : `${filename}.asm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download helper for BIN files
 */
export function downloadGameFlowBIN(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".bin") ? filename : `${filename}.bin`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
