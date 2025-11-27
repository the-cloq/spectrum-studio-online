import { TAPGenerator } from "./tapGenerator";
import { type Screen, type GameFlowScreen, type Level, type Block, type GameObject, type Sprite, SPECTRUM_COLORS } from "@/types/spectrum";

/**
 * Export Game Flow to TAP file
 * Includes loading screens, title screens with keyboard menus, and level data
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
    // Include any screen we can resolve (even if it's a tile-based game screen)
    .filter((screen): screen is Screen => !!screen);

  if (validFlowScreens.length === 0) {
    return tap.toBlob(); // No valid screens to export
  }

  // Use first valid screen as loading screen and second as the initial game screen
  const loadingScreen = validFlowScreens[0];
  const targetScreen = validFlowScreens.length > 1 ? validFlowScreens[1] : loadingScreen;

  const loadingScr = encodeScreenToSCR(loadingScreen, blocks, objects, sprites);
  const targetScr = encodeScreenToSCR(targetScreen, blocks, objects, sprites);

  // Build BASIC loader:
  // 10 CLEAR 32767
  // 20 LOAD "" SCREEN$
  // 30 LOAD "" CODE
  // 40 RANDOMIZE USR 32768
  const basicProgram: number[] = [];

  // Line 10: CLEAR 32767
  basicProgram.push(0x00, 0x0a); // Line number 10
  let lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00); // Length placeholder
  basicProgram.push(0xfd); // CLEAR token
  basicProgram.push(0x20); // Space
  // "32767" as ASCII
  basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x37);
  // Encoded number 32767 (matches TAPGenerator.addBasicLoader)
  basicProgram.push(0x0e, 0x00, 0x00, 0xff, 0x7f, 0x00);
  basicProgram.push(0x0d); // ENTER
  let lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 20: LOAD "" SCREEN$
  basicProgram.push(0x00, 0x14); // Line number 20
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00); // Length placeholder
  basicProgram.push(0xef); // LOAD token
  basicProgram.push(0x20); // Space
  basicProgram.push(0x22, 0x22); // Empty string ""
  basicProgram.push(0x20); // Space
  basicProgram.push(0xaa); // SCREEN$ token
  basicProgram.push(0x0d); // ENTER
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 30: LOAD "" CODE
  basicProgram.push(0x00, 0x1e); // Line number 30
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00); // Length placeholder
  basicProgram.push(0xef); // LOAD token
  basicProgram.push(0x20); // Space
  basicProgram.push(0x22, 0x22); // Empty string ""
  basicProgram.push(0x20); // Space
  basicProgram.push(0xaf); // CODE token
  basicProgram.push(0x0d); // ENTER
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // Line 40: RANDOMIZE USR 32768
  basicProgram.push(0x00, 0x28); // Line number 40
  lineStart = basicProgram.length;
  basicProgram.push(0x00, 0x00); // Length placeholder
  basicProgram.push(0xf9); // RANDOMIZE token
  basicProgram.push(0x20); // Space
  basicProgram.push(0xc0); // USR token
  basicProgram.push(0x20); // Space
  // "32768" as ASCII
  basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x38);
  // Encoded number 32768 (matches TAPGenerator.addBasicLoader)
  basicProgram.push(0x0e, 0x00, 0x00, 0x00, 0x80, 0x00);
  basicProgram.push(0x0d); // ENTER
  lineLength = basicProgram.length - lineStart - 2;
  basicProgram[lineStart] = lineLength & 0xff;
  basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

  // BASIC program header (same layout as TAPGenerator.addBasicLoader)
  const headerData: number[] = [
    0x00, // Header block flag
    0x00, // BASIC program type
  ];
  const filename = "Loader    ";
  for (let i = 0; i < 10; i++) {
    headerData.push(filename.charCodeAt(i));
  }
  headerData.push(basicProgram.length & 0xff);
  headerData.push((basicProgram.length >> 8) & 0xff);
  headerData.push(0x0a, 0x00); // Autostart line 10
  headerData.push(basicProgram.length & 0xff);
  headerData.push((basicProgram.length >> 8) & 0xff);

  tap.addBlock(headerData);
  tap.addBlock([0xff, ...basicProgram]);

  // Add loading screen as SCREEN$ block (CODE header with start 16384 and length 6912)
  const loadingName = projectName.substring(0, 10).padEnd(10, " ");
  tap.addHeader(loadingName, 6912, 16384);
  tap.addDataBlock(loadingScr);

  // Build Z80 game engine with keyboard control at 32768
  const engine: number[] = [];
  const engineStart = 32768;

  // Find player object position from targetScreen
  let playerX = 16; // Default center position (tile coordinates)
  let playerY = 12;
  let playerSpriteWidth = 8;
  let playerSpriteHeight = 8;
  let playerPixels: number[][] = [];

  if (targetScreen.placedObjects) {
    for (const placed of targetScreen.placedObjects) {
      const obj = objects.find(o => o.id === placed.objectId);
      if (obj?.type === "player") {
        playerX = placed.x;
        playerY = placed.y;
        
        // Find player sprite
        const sprite = sprites.find(s => s.id === obj.spriteId);
        if (sprite?.frames?.[0]?.pixels) {
          playerPixels = sprite.frames[0].pixels;
          playerSpriteWidth = playerPixels[0]?.length || 8;
          playerSpriteHeight = playerPixels.length || 8;
        }
        break;
      }
    }
  }

  // Convert tile coords to pixel coords
  const playerXPixel = playerX * 8;
  const playerYPixel = playerY * 8;

  // ===== PHASE 2: KEYBOARD BORDER COLOR TEST =====
  // Copy background screen to display memory
  
  // LD HL, <source address of background screen data> (patched below)
  engine.push(0x21);
  const bgAddrIdx = engine.length;
  engine.push(0x00, 0x00); // placeholder - will be patched with bgScreenDataAddr

  // LD DE, 16384 (screen memory start)
  engine.push(0x11, 0x00, 0x40);

  // LD BC, 6912 (full screen size)
  engine.push(0x01, 0x00, 0x1b);
  
  // LDIR (copy all 6912 bytes from background to screen)
  engine.push(0xed, 0xb0);

  // ===== GAME LOOP: Test keyboard with border color =====
  const gameLoopAddr = engineStart + engine.length;

  // Read keyboard port DFFE (YUIOP half-row: P=bit0, O=bit1)
  // LD BC, 0xDFFE
  engine.push(0x01, 0xfe, 0xdf);
  // IN A, (C)
  engine.push(0xed, 0x78);
  
  // Check O key (bit 1)
  // BIT 1, A
  engine.push(0xcb, 0x4f);
  // JR NZ, check_p (if O not pressed, check P)
  engine.push(0x20, 0x05);
  
  // O pressed - set border to RED (color 2)
  // LD A, 2
  engine.push(0x3e, 0x02);
  // OUT (0xFE), A
  engine.push(0xd3, 0xfe);
  // JR loop (skip P check)
  engine.push(0x18, 0x06);

  // check_p:
  // Check P key (bit 0)
  // BIT 0, A
  engine.push(0xcb, 0x47);
  // JR NZ, loop (if P not pressed, just loop)
  engine.push(0x20, 0x04);
  
  // P pressed - set border to CYAN (color 5)
  // LD A, 5
  engine.push(0x3e, 0x05);
  // OUT (0xFE), A
  engine.push(0xd3, 0xfe);

  // loop:
  // Jump back to game loop
  const loopOffset = gameLoopAddr - (engineStart + engine.length + 2);
  engine.push(0x18, loopOffset & 0xff);

  // ===== DATA SECTION =====

  // Background screen data follows engine code
  const bgScreenDataAddr = engineStart + engine.length;

  // Patch the background screen address placeholder
  engine[bgAddrIdx] = bgScreenDataAddr & 0xff;
  engine[bgAddrIdx + 1] = (bgScreenDataAddr >> 8) & 0xff;

  // Build final code data: engine + background screen data (Phase 1 only)
  const codeData = [
    ...engine, 
    ...targetScr
  ];

  const codeName = "GameFlow  ";
  tap.addHeader(codeName, codeData.length, engineStart);
  tap.addDataBlock(codeData);

  return tap.toBlob();
}

/**
 * Encode a screen to ZX Spectrum SCR format (6912 bytes)
 */
function encodeScreenToSCR(screen: Screen, blocks: Block[], objects: GameObject[], sprites: Sprite[]): number[] {
  const scrData = new Array(6912).fill(0);

  // Handle tile-based screens (game levels)
  if (screen.tiles && !screen.pixels) {
    // Create a pixel array by rendering tiles
    const pixels: (typeof SPECTRUM_COLORS[0])[][] = Array.from({ length: 192 }, () => 
      Array(256).fill(SPECTRUM_COLORS[0])
    );

    // Render each tile (8x8 blocks)
    for (let ty = 0; ty < screen.tiles.length && ty < 24; ty++) {
      for (let tx = 0; tx < screen.tiles[ty].length && tx < 32; tx++) {
        const blockId = screen.tiles[ty][tx];
        if (!blockId) continue;

        const block = blocks.find(b => b.id === blockId);
        if (!block || !block.sprite.frames[0]) continue;

        const spritePixels = block.sprite.frames[0].pixels;
        
        // Render the 8x8 sprite into the pixel array
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

    // Render placed objects on top of tiles
    if (screen.placedObjects) {
      for (const placedObj of screen.placedObjects) {
        const gameObject = objects.find(o => o.id === placedObj.objectId);
        if (!gameObject) continue;

        // Find the sprite - use primary sprite or directional animation
        let spriteId = gameObject.spriteId;
        if (placedObj.direction === "left" && gameObject.animations?.moveLeft) {
          spriteId = gameObject.animations.moveLeft;
        } else if (placedObj.direction === "right" && gameObject.animations?.moveRight) {
          spriteId = gameObject.animations.moveRight;
        }

        // Find the sprite in the sprites array
        const objectSprite = sprites.find(s => s.id === spriteId);
        if (!objectSprite || !objectSprite.frames[0]) continue;

        const objPixels = objectSprite.frames[0].pixels;
        
        // Render object sprite at its placed position
        for (let sy = 0; sy < objPixels.length; sy++) {
          for (let sx = 0; sx < objPixels[sy].length; sx++) {
            const py = placedObj.y * 8 + sy;
            const px = placedObj.x * 8 + sx;
            const colorIndex = objPixels[sy][sx];
            
            // Only render non-transparent pixels (colorIndex !== 0)
            if (colorIndex !== 0 && py >= 0 && py < 192 && px >= 0 && px < 256) {
              pixels[py][px] = SPECTRUM_COLORS[colorIndex] || SPECTRUM_COLORS[0];
            }
          }
        }
      }
    }

    // Now encode this pixel array to SCR
    return encodePixelsToSCR(pixels);
  }

  if (!screen.pixels) return scrData;

  // Encode screen in ZX Spectrum format
  return encodePixelsToSCR(screen.pixels);
}

/**
 * Encode a pixel array to ZX Spectrum SCR format (6912 bytes)
 */
function encodePixelsToSCR(pixels: (typeof SPECTRUM_COLORS[0])[][]): number[] {
  const scrData = new Array(6912).fill(0);

  for (let by = 0; by < 192; by += 8) {
    for (let bx = 0; bx < 256; bx += 8) {
      // Find the two colors in this 8x8 block
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

      // Set attribute byte
      const inkValue = inkColor.ink;
      const paperValue = paperColor.ink;
      const bright = inkColor.bright || paperColor.bright ? 1 : 0;
      const attrIndex = 6144 + (by / 8) * 32 + (bx / 8);
      scrData[attrIndex] = (bright << 6) | (paperValue << 3) | inkValue;

      // Set bitmap bytes
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
 * Create Z80 game engine that handles screen flow and keyboard input
 */
function createGameFlowEngine(
  gameFlow: GameFlowScreen[],
  screens: Screen[],
  levels: Level[]
): number[] {
  const engine: number[] = [];

  // Game engine in Z80 assembly
  // This is a simplified version that:
  // 1. Shows loading screens
  // 2. Shows title screen with menu
  // 3. Waits for keyboard input
  // 4. Loads appropriate screen/level based on key press

  // Initialize: Set border to black
  engine.push(0x3E, 0x00);       // LD A, 0
  engine.push(0xD3, 0xFE);       // OUT (254), A

  // Display first loading screen
  engine.push(0xCD, 0x00, 0x80); // CALL DisplayScreen (routine at 32768 + offset)

  // Main menu loop
  engine.push(0xCD, 0x50, 0x80); // CALL DisplayMenu

  // Wait for key press
  const KEY_SCAN_LOOP = engine.length;
  engine.push(0xCD, 0xBB, 0x15); // CALL 5563 (ROM keyboard scan)

  // Check each access key defined in game flow
  gameFlow.forEach((flowScreen) => {
    const screen = screens.find(s => s.id === flowScreen.screenId);
    if (flowScreen.accessKey && screen?.type !== "loading") {
      // Compare with access key
      engine.push(0xFE, flowScreen.accessKey.charCodeAt(0)); // CP key_code
      // TODO: Add jump to screen handler
    }
  });

  // Loop back if no valid key
  engine.push(0x18, -(engine.length - KEY_SCAN_LOOP + 2)); // JR back to scan loop

  // DisplayScreen routine
  engine.push(0x21, 0x00, 0x40); // LD HL, 16384 (screen memory)
  // TODO: Copy screen data from data area

  // Return
  engine.push(0xC9); // RET

  return engine;
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
