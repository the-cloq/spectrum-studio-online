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

  // Build Z80 game engine at 32768 with player movement, jumping, and collision detection
  const engine: number[] = [];
  const engineStart = 32768;

  // Memory map:
  // 32768-33000: Game engine code
  // 33000: Game state variables (32 bytes)
  // 33032: Background screen buffer (6912 bytes) = 39944
  // 39944+: Player sprite data

  const gameStateAddr = 33000;
  const bgBufferAddr = 33032;
  const playerXAddr = gameStateAddr;
  const playerYAddr = gameStateAddr + 2;
  const playerVXAddr = gameStateAddr + 4;
  const playerVYAddr = gameStateAddr + 5;
  const jumpStateAddr = gameStateAddr + 6;
  const frameCountAddr = gameStateAddr + 7;
  const facingDirAddr = gameStateAddr + 8;

  // Find player object in target screen
  const playerObj = targetScreen.placedObjects?.find(obj => {
    const gameObj = objects.find(o => o.id === obj.objectId);
    return gameObj?.type === "player";
  });

  const TILE_SIZE = 8; // 8×8 Spectrum pixel grid cells
  const initialPlayerX = playerObj ? playerObj.x * TILE_SIZE : 128;
  const initialPlayerY = playerObj ? playerObj.y * TILE_SIZE : 144;

  // Get player sprite
  let playerSprite: Sprite | undefined;
  if (playerObj) {
    const gameObj = objects.find(o => o.id === playerObj.objectId);
    if (gameObj) {
      playerSprite = sprites.find(s => s.id === gameObj.spriteId);
    }
  }

  // ===== INITIALIZATION =====
  
  // Copy background to buffer at bgBufferAddr
  const bgCopyStart = engine.length;
  engine.push(0x21); // LD HL, <bgScreenDataAddr>
  const bgDataAddrIdx = engine.length;
  engine.push(0x00, 0x00);
  engine.push(0x11, bgBufferAddr & 0xff, (bgBufferAddr >> 8) & 0xff); // LD DE, bgBufferAddr
  engine.push(0x01, 0x00, 0x1b); // LD BC, 6912
  engine.push(0xed, 0xb0); // LDIR

  // Initialize player position
  engine.push(0x21, initialPlayerX & 0xff, (initialPlayerX >> 8) & 0xff); // LD HL, initialPlayerX
  engine.push(0x22, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD (playerXAddr), HL
  engine.push(0x21, initialPlayerY & 0xff, (initialPlayerY >> 8) & 0xff); // LD HL, initialPlayerY
  engine.push(0x22, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD (playerYAddr), HL

  // Initialize velocities to 0
  engine.push(0x3e, 0x00); // LD A, 0
  engine.push(0x32, playerVXAddr & 0xff, (playerVXAddr >> 8) & 0xff); // LD (playerVXAddr), A
  engine.push(0x32, playerVYAddr & 0xff, (playerVYAddr >> 8) & 0xff); // LD (playerVYAddr), A
  engine.push(0x32, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD (jumpStateAddr), A
  engine.push(0x32, frameCountAddr & 0xff, (frameCountAddr >> 8) & 0xff); // LD (frameCountAddr), A
  engine.push(0x3e, 0x01); // LD A, 1 (facing right)
  engine.push(0x32, facingDirAddr & 0xff, (facingDirAddr >> 8) & 0xff); // LD (facingDirAddr), A

  // ===== MAIN GAME LOOP =====
  const mainLoopStart = engine.length;

  // Increment frame counter (for 12fps animation at 50fps interrupt)
  engine.push(0x3a, frameCountAddr & 0xff, (frameCountAddr >> 8) & 0xff); // LD A, (frameCountAddr)
  engine.push(0x3c); // INC A
  engine.push(0xfe, 0x04); // CP 4 (50/4 ≈ 12fps)
  engine.push(0x20, 0x02); // JR NZ, +2
  engine.push(0x3e, 0x00); // LD A, 0 (reset counter)
  engine.push(0x32, frameCountAddr & 0xff, (frameCountAddr >> 8) & 0xff); // LD (frameCountAddr), A

  // ===== INPUT HANDLING =====
  
  // Reset horizontal velocity
  engine.push(0x3e, 0x00); // LD A, 0
  engine.push(0x32, playerVXAddr & 0xff, (playerVXAddr >> 8) & 0xff); // LD (playerVXAddr), A

  // Check left arrow (CAPS SHIFT + 5)
  engine.push(0x3e, 0xfe); // LD A, 0xFE (read keyboard half-row 0xFEFE)
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x47); // BIT 0, A (check CAPS SHIFT)
  engine.push(0x20, 0x09); // JR NZ, skip_left
  // CAPS pressed, now check 5 key (in row 0xF7FE)
  engine.push(0x3e, 0xf7); // LD A, 0xF7
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x57); // BIT 2, A (5 key)
  engine.push(0x20, 0x06); // JR NZ, skip_left
  // Left pressed: set VX = -2
  engine.push(0x3e, 0xfe); // LD A, -2
  engine.push(0x32, playerVXAddr & 0xff, (playerVXAddr >> 8) & 0xff); // LD (playerVXAddr), A
  engine.push(0x3e, 0x00); // LD A, 0 (facing left)
  engine.push(0x32, facingDirAddr & 0xff, (facingDirAddr >> 8) & 0xff); // LD (facingDirAddr), A

  // Check right arrow (CAPS SHIFT + 8)
  engine.push(0x3e, 0xfe); // LD A, 0xFE
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x47); // BIT 0, A (CAPS SHIFT)
  engine.push(0x20, 0x09); // JR NZ, skip_right
  engine.push(0x3e, 0xf7); // LD A, 0xF7
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x67); // BIT 4, A (8 key)
  engine.push(0x20, 0x06); // JR NZ, skip_right
  // Right pressed: set VX = 2
  engine.push(0x3e, 0x02); // LD A, 2
  engine.push(0x32, playerVXAddr & 0xff, (playerVXAddr >> 8) & 0xff); // LD (playerVXAddr), A
  engine.push(0x3e, 0x01); // LD A, 1 (facing right)
  engine.push(0x32, facingDirAddr & 0xff, (facingDirAddr >> 8) & 0xff); // LD (facingDirAddr), A

  // Check jump (CAPS SHIFT + 7)
  engine.push(0x3a, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD A, (jumpStateAddr)
  engine.push(0xfe, 0x00); // CP 0
  engine.push(0x20, 0x10); // JR NZ, skip_jump (already jumping)
  engine.push(0x3e, 0xfe); // LD A, 0xFE
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x47); // BIT 0, A (CAPS SHIFT)
  engine.push(0x20, 0x0a); // JR NZ, skip_jump
  engine.push(0x3e, 0xf7); // LD A, 0xF7
  engine.push(0xdb, 0xfe); // IN A, (0xFE)
  engine.push(0xcb, 0x5f); // BIT 3, A (7 key)
  engine.push(0x20, 0x04); // JR NZ, skip_jump
  // Jump pressed: initiate jump
  engine.push(0x3e, 0x01); // LD A, 1
  engine.push(0x32, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD (jumpStateAddr), A

  // ===== PHYSICS UPDATE =====

  // Apply horizontal velocity
  engine.push(0x2a, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD HL, (playerXAddr)
  engine.push(0x3a, playerVXAddr & 0xff, (playerVXAddr >> 8) & 0xff); // LD A, (playerVXAddr)
  engine.push(0x87); // ADD A, A (sign extend to 16-bit via ADD HL, A simulation)
  engine.push(0x6f); // LD L, A (simplified: just add to L)
  engine.push(0x22, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD (playerXAddr), HL

  // Apply jump/gravity
  engine.push(0x3a, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD A, (jumpStateAddr)
  engine.push(0xfe, 0x00); // CP 0
  engine.push(0x28, 0x1c); // JR Z, apply_gravity (not jumping)
  
  // In jump: apply upward velocity based on jump frame
  engine.push(0xfe, 0x0a); // CP 10 (jump duration)
  engine.push(0x30, 0x04); // JR NC, end_jump
  // Continue jump
  engine.push(0x3e, 0xfc); // LD A, -4 (upward)
  engine.push(0x32, playerVYAddr & 0xff, (playerVYAddr >> 8) & 0xff); // LD (playerVYAddr), A
  engine.push(0x18, 0x0a); // JR apply_vy
  // End jump
  engine.push(0x3e, 0x00); // LD A, 0
  engine.push(0x32, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD (jumpStateAddr), A
  engine.push(0x18, 0x04); // JR apply_gravity
  
  // Increment jump frame
  engine.push(0x3a, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD A, (jumpStateAddr)
  engine.push(0x3c); // INC A
  engine.push(0x32, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD (jumpStateAddr), A
  engine.push(0x18, 0x04); // JR apply_vy

  // Apply gravity (not jumping)
  engine.push(0x3e, 0x02); // LD A, 2 (downward)
  engine.push(0x32, playerVYAddr & 0xff, (playerVYAddr >> 8) & 0xff); // LD (playerVYAddr), A

  // Apply vertical velocity
  engine.push(0x2a, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD HL, (playerYAddr)
  engine.push(0x3a, playerVYAddr & 0xff, (playerVYAddr >> 8) & 0xff); // LD A, (playerVYAddr)
  engine.push(0x6f); // LD L, A (simplified add)
  engine.push(0x22, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD (playerYAddr), HL

  // Simple bounds check (keep on screen)
  // Check Y < 0
  engine.push(0x2a, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD HL, (playerYAddr)
  engine.push(0x7c); // LD A, H
  engine.push(0xfe, 0x80); // CP 0x80 (negative if >= 0x8000)
  engine.push(0x38, 0x06); // JR C, check_y_max
  engine.push(0x21, 0x00, 0x00); // LD HL, 0
  engine.push(0x22, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD (playerYAddr), HL
  
  // Check Y > 176 (keep player above bottom)
  engine.push(0x2a, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD HL, (playerYAddr)
  engine.push(0x7d); // LD A, L
  engine.push(0xfe, 0xb0); // CP 176
  engine.push(0x38, 0x08); // JR C, check_x
  engine.push(0x21, 0xb0, 0x00); // LD HL, 176
  engine.push(0x22, playerYAddr & 0xff, (playerYAddr >> 8) & 0xff); // LD (playerYAddr), HL
  engine.push(0xaf); // XOR A (reset jump state when hitting ground)
  engine.push(0x32, jumpStateAddr & 0xff, (jumpStateAddr >> 8) & 0xff); // LD (jumpStateAddr), A

  // Check X bounds (0 to 240)
  engine.push(0x2a, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD HL, (playerXAddr)
  engine.push(0x7c); // LD A, H
  engine.push(0xfe, 0x80); // CP 0x80
  engine.push(0x38, 0x04); // JR C, check_x_max
  engine.push(0x21, 0x00, 0x00); // LD HL, 0
  engine.push(0x22, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD (playerXAddr), HL
  engine.push(0x2a, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD HL, (playerXAddr)
  engine.push(0x7d); // LD A, L
  engine.push(0xfe, 0xf0); // CP 240
  engine.push(0x38, 0x04); // JR C, render
  engine.push(0x21, 0xf0, 0x00); // LD HL, 240
  engine.push(0x22, playerXAddr & 0xff, (playerXAddr >> 8) & 0xff); // LD (playerXAddr), HL

  // ===== RENDERING =====

  // Copy background buffer to screen memory
  engine.push(0x21, bgBufferAddr & 0xff, (bgBufferAddr >> 8) & 0xff); // LD HL, bgBufferAddr
  engine.push(0x11, 0x00, 0x40); // LD DE, 16384
  engine.push(0x01, 0x00, 0x1b); // LD BC, 6912
  engine.push(0xed, 0xb0); // LDIR

  // Draw player sprite (simplified: call sprite routine)
  // We'll add sprite data and drawing routine after the main loop
  engine.push(0xcd); // CALL <drawSpriteRoutine>
  const drawSpriteCallIdx = engine.length;
  engine.push(0x00, 0x00); // Address to be patched

  // Small delay loop
  engine.push(0x01, 0xff, 0x0f); // LD BC, 0x0FFF
  const delayLoopStart = engine.length;
  engine.push(0x0b); // DEC BC
  engine.push(0x78); // LD A, B
  engine.push(0xb1); // OR C
  engine.push(0x20, 0xfb); // JR NZ, delay_loop

  // Jump back to main loop
  const jumpOffset = mainLoopStart - (engine.length + 2);
  engine.push(0x18, jumpOffset & 0xff); // JR main_loop

  // ===== DRAW SPRITE ROUTINE =====
  const drawSpriteRoutine = engine.length + engineStart;
  engine[drawSpriteCallIdx] = drawSpriteRoutine & 0xff;
  engine[drawSpriteCallIdx + 1] = (drawSpriteRoutine >> 8) & 0xff;

  // Draw sprite routine placeholder – currently no-op but keeps stack balanced
  engine.push(0xc9); // RET


  // ===== DATA SECTION =====

  // Patch background data address
  const bgScreenDataAddr = engineStart + engine.length;
  engine[bgDataAddrIdx] = bgScreenDataAddr & 0xff;
  engine[bgDataAddrIdx + 1] = (bgScreenDataAddr >> 8) & 0xff;

  const codeData = [...engine, ...targetScr];

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
            const py = placedObj.y + sy;
            const px = placedObj.x + sx;
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
