import { TAPGenerator } from "./tapGenerator";
import { type Screen, type GameFlowScreen, type Level, type Block, type GameObject, type Sprite, SPECTRUM_COLORS } from "@/types/spectrum";
import { packBlockBank, generateBlockBankAsm } from "./blockPacker";
import { packObjectBank, generateObjectBankAsm } from "./objectPacker";
import { packScreenBank, generateScreenBankAsm } from "./screenPacker";
import { packSpriteBank, generateSpriteBankAsm, createSpriteIndexMap } from "./spritePacker";
import { getKeyMapping } from "./spectrumKeyboardMap";

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

  // Only pack game screens that are actually used in the Game Flow / Levels
  const usedScreenIds = new Set<string>();
  for (const flow of sortedFlow) {
    const directScreen = screens.find(s => s.id === flow.screenId);
    if (directScreen) {
      if (directScreen.type === "game") {
        usedScreenIds.add(directScreen.id);
      }
    } else {
      const level = levels.find(l => l.id === flow.screenId);
      if (level) {
        for (const sid of level.screenIds) {
          usedScreenIds.add(sid);
        }
      }
    }
  }
  const gameScreens = screens.filter(s => s.type === "game" && usedScreenIds.has(s.id));
  const screenBank = packScreenBank(gameScreens, blockIndexMap, objectIndexMap, objects);
  // First pass: Build engine with dummy addresses to calculate size
  const dummyEngine = createBinaryGameEngine(
    0, 0, 0, 0, 0,
    validFlowScreens[1] || validFlowScreens[0],
    blocks,
    objects,
    sprites
  );

  // Calculate memory layout - everything in one continuous block
  const codeStart = 32768;
  const engineSize = dummyEngine.length;
  const spriteBankAddr = codeStart + engineSize;
  const blockBankAddr = spriteBankAddr + spriteBank.length;
  const objectBankAddr = blockBankAddr + blockBank.length;
  const screenBankAddr = objectBankAddr + objectBank.length;
  const bgScreenAddr = screenBankAddr + screenBank.length;

  // Second pass: Build engine with correct addresses
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

  // Combine all data into one continuous block
  const combinedCode = [
    ...engine,
    ...Array.from(spriteBank),
    ...Array.from(blockBank),
    ...Array.from(objectBank),
    ...Array.from(screenBank)
  ];

  // TAP debug logging is performed after building the BASIC program and TAP blocks below.

  // MINIMAL DIAGNOSTIC TEST: BASIC program ONLY (no SCREEN$, no CODE blocks at all)
  // This tests if the BASIC program itself parses correctly without any data blocks
  tap.addBasicLoader(32768, 32768); // Dummy values - CODE won't exist but BASIC should still parse

  // All data blocks disabled for minimal BASIC-only diagnostic test
  // const loadingName = projectName.substring(0, 10).padEnd(10, " ");
  // tap.addHeader(loadingName, 6912, 16384);
  // tap.addDataBlock(loadingScr);
  // const codeName = "Level     ";
  // tap.addHeader(codeName, combinedCode.length, codeStart);
  // tap.addDataBlock(combinedCode);

  console.log("[TAP DEBUG] Final TAP layout", {
    blocksOrder: "MINIMAL DIAGNOSTIC TEST: BASIC header, BASIC data ONLY (no SCREEN$, no CODE at all)",
    codeStart,
    engineSizeDummy: engineSize,
    engineSizeFinal: engine.length,
    spriteBankSize: spriteBank.length,
    blockBankSize: blockBank.length,
    objectBankSize: objectBank.length,
    screenBankSize: screenBank.length,
    combinedCodeLength: combinedCode.length,
    headerLength: combinedCode.length,
    tapDataLengthFlagPlusPayload: combinedCode.length + 1,
    clearLine: 32767,
  });

  tap.debugDump();

  return tap.toBlob();
}

/**
 * Create Z80 game engine that reads binary data banks
 * This version reads from the binary tables instead of embedding SCR data
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

  // ===== INITIALIZATION =====
  
  // Clear screen memory (pixel area)
  engine.push(0x21, 0x00, 0x40);  // LD HL, 16384
  engine.push(0x11, 0x01, 0x40);  // LD DE, 16385
  engine.push(0x01, 0xff, 0x17);  // LD BC, 6143
  engine.push(0x36, 0x00);        // LD (HL), 0
  engine.push(0xed, 0xb0);        // LDIR

  // Set attributes (white INK on black PAPER, BRIGHT)
  engine.push(0x21, 0x00, 0x58);  // LD HL, 22528
  engine.push(0x11, 0x01, 0x58);  // LD DE, 22529
  engine.push(0x01, 0xff, 0x02);  // LD BC, 767
  engine.push(0x36, 0x47);        // LD (HL), 71 (BRIGHT 1, PAPER 0, INK 7)
  engine.push(0xed, 0xb0);        // LDIR

  // Set border to black
  engine.push(0x3e, 0x00);        // LD A, 0
  engine.push(0xd3, 0xfe);        // OUT (254), A

  // ===== RENDER SCREEN FROM BINARY DATA =====
  
  // Find target screen in screen bank
  // For now, render first screen (screenId at offset 0)
  // Screen bank format: pointer_table(2) + screen0_data
  // Screen data: width(1) height(1) tiles[width*height] objects[]
  
  // Load screen bank address
  engine.push(0x21);              // LD HL, screenBankAddr
  const screenBankAddrIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Skip pointer table (2 bytes) to get to first screen data
  engine.push(0x23, 0x23);        // INC HL, INC HL
  
  // Read screen width (1 byte) into D
  engine.push(0x56);              // LD D, (HL)
  engine.push(0x23);              // INC HL
  
  // Read screen height (1 byte) into E
  engine.push(0x5e);              // LD E, (HL)
  engine.push(0x23);              // INC HL
  
  // Set tile count to 768 (32 * 24 = 0x0300) in BC
  engine.push(0x01, 0x00, 0x03);  // LD BC, 768
  
  // Now HL points to first tile byte
  // Tile format: flat array of 1-byte block indices
  // Position (x, y) derived from index: x = index % 32, y = index / 32
  
  // Initialize tile position counter: D'E' will track current X,Y
  engine.push(0xd9);              // EXX (switch to alternate registers)
  engine.push(0x16, 0x00);        // LD D', 0 (tile X counter)
  engine.push(0x1e, 0x00);        // LD E', 0 (tile Y counter)
  engine.push(0xd9);              // EXX (back to main registers)
  
  // ===== TILE RENDERING LOOP =====
  const tileLoopStart = 32768 + engine.length;
  
  // Check if BC == 0 (no more tiles)
  engine.push(0x78);              // LD A, B
  engine.push(0xb1);              // OR C
  const jzToPlayerSetup = engine.length;
  engine.push(0x28, 0x00);        // JR Z, player_setup (placeholder)
  
  // Read block index (1 byte) from current tile position
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x23);              // INC HL (advance to next tile)
  
  // Save tile counter BC and data pointer HL
  engine.push(0xc5);              // PUSH BC
  engine.push(0xe5);              // PUSH HL
  
  // Get current tile X,Y position from alternate registers
  engine.push(0xd9);              // EXX
  engine.push(0x7a);              // LD A, D' (tile X)
  engine.push(0x47);              // LD B, A
  engine.push(0x7b);              // LD A, E' (tile Y)
  engine.push(0x4f);              // LD C, A
  engine.push(0xd9);              // EXX
  // Now B = tile X (0-31), C = tile Y (0-23)
  
  // Save block index in A to D register
  engine.push(0x57);              // LD D, A
  
  // Extend block index from A (8-bit) to HL (16-bit)
  engine.push(0x6f);              // LD L, A
  engine.push(0x26, 0x00);        // LD H, 0
  
  // Look up block in block bank
  // Block bank format: blockCount(2) + blocks[]
  // Each block: type(1) spriteIndex(2) propsOffset(2) = 5 bytes per block
  
  // Calculate block address: blockBankAddr + 2 + (blockIndex * 5)
  // First multiply HL by 5
  engine.push(0x29);              // ADD HL, HL  (HL = blockIndex * 2)
  engine.push(0x54);              // LD D, H
  engine.push(0x5d);              // LD E, L     (DE = blockIndex * 2)
  engine.push(0x29);              // ADD HL, HL  (HL = blockIndex * 4)
  engine.push(0x19);              // ADD HL, DE  (HL = blockIndex * 5)
  
  // Add block bank base address + 2
  engine.push(0x11);              // LD DE, blockBankAddr + 2
  const blockBankAddrIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x19);              // ADD HL, DE
  
  // Skip block type (1 byte)
  engine.push(0x23);              // INC HL
  
  // Read sprite index into DE
  engine.push(0x5e);              // LD E, (HL)
  engine.push(0x23);              // INC HL
  engine.push(0x56);              // LD D, (HL)
  
  // Look up sprite in sprite bank
  // Sprite bank format: spriteCount(2) + sprites[]
  // Each sprite: width(1) height(1) frameCount(2) frameDataOffset(2) collisionBox(4) = 10 bytes per sprite
  
  // Calculate sprite address: spriteBankAddr + 2 + (spriteIndex * 10)
  engine.push(0xeb);              // EX DE, HL   (HL = spriteIndex)
  
  // Multiply by 10: HL * 8 + HL * 2
  engine.push(0x29);              // ADD HL, HL  (HL * 2)
  engine.push(0x54);              // LD D, H
  engine.push(0x5d);              // LD E, L     (DE = spriteIndex * 2)
  engine.push(0x29);              // ADD HL, HL  (HL * 4)
  engine.push(0x29);              // ADD HL, HL  (HL * 8)
  engine.push(0x19);              // ADD HL, DE  (HL * 10)
  
  // Add sprite bank base address + 2
  engine.push(0x11);              // LD DE, spriteBankAddr + 2
  const spriteBankAddrIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x19);              // ADD HL, DE
  
  // Read sprite width
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x23);              // INC HL
  engine.push(0x32);              // LD (spriteWidth), A
  const spriteWidthAddr = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Read sprite height
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x23);              // INC HL
  engine.push(0x32);              // LD (spriteHeight), A
  const spriteHeightAddr = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Skip frame count (2 bytes)
  engine.push(0x23, 0x23);        // INC HL, INC HL
  
  // Read frame data offset into HL
  engine.push(0x5e);              // LD E, (HL)
  engine.push(0x23);              // INC HL
  engine.push(0x56);              // LD D, (HL)
  engine.push(0xeb);              // EX DE, HL   (HL = frame data offset)
  
  // Add sprite bank base to get absolute address
  engine.push(0x11);              // LD DE, spriteBankAddr
  const spriteBankAddrIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x19);              // ADD HL, DE  (HL = frame pixel data)
  
  // Now render the 8x8 sprite at tile position
  // Pop tile X, Y from stack (currently in D, E from earlier)
  engine.push(0xd1);              // POP DE (restore original IX)
  engine.push(0xd1);              // POP DE (now DE has correct IX value)
  engine.push(0xdd, 0xe1);        // POP IX
  engine.push(0xc1);              // POP BC
  
  // For simplicity, just draw a white 8x8 block at the tile position
  // TODO: Implement proper sprite pixel rendering
  // This is a placeholder that draws white blocks for non-empty tiles
  
  // Restore tile counter and data pointer
  engine.push(0xe1);              // POP HL
  engine.push(0xc1);              // POP BC
  
  // Advance tile position counter (X, Y)
  engine.push(0xd9);              // EXX (switch to alternate registers)
  engine.push(0x14);              // INC D' (increment X)
  engine.push(0x7a);              // LD A, D' (check if X == 32)
  engine.push(0xfe, 0x20);        // CP 32
  const jrNoWrapX = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, no_wrap_x (placeholder)
  
  // Wrapped to next row - reset X to 0, increment Y
  engine.push(0x16, 0x00);        // LD D', 0 (reset X)
  engine.push(0x1c);              // INC E' (increment Y)
  
  const noWrapXPos = engine.length;
  engine.push(0xd9);              // EXX (back to main registers)
  
  // Decrement tile counter
  engine.push(0x0b);              // DEC BC
  
  // Loop back
  let loopOffset = tileLoopStart - (32768 + engine.length + 2);
  engine.push(0x18, loopOffset & 0xff);  // JR tile_loop
  
  // ===== PLAYER SETUP =====
  const playerSetupPos = engine.length;
  
  // Clean up stack (tile counter and data pointer were already popped in loop)
  
  // Initialize player position
  const playerXPixel = 128;
  const playerYPixel = 152;  // Ground level (192 - 40 pixels from bottom)
  
  engine.push(0x3e, playerXPixel & 0xff);  // LD A, playerX
  engine.push(0x32);              // LD (playerX), A
  const playerXVarIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0x3e, playerYPixel & 0xff);  // LD A, playerY
  engine.push(0x32);              // LD (playerY), A
  const playerYVarIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Initialize isJumping to 0
  engine.push(0xaf);              // XOR A
  engine.push(0x32);              // LD (isJumping), A
  const isJumpingVarIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Initialize jumpFrameIndex to 0
  engine.push(0x32);              // LD (jumpFrameIndex), A
  const jumpFrameIdxVarIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // ===== MAIN GAME LOOP =====
  const gameLoopAddr = 32768 + engine.length;
  
  // Find player object to get key bindings
  const playerObject = objects.find(obj => obj.type === "player");
  const keyLeft = playerObject?.properties.keyLeft || "q";
  const keyRight = playerObject?.properties.keyRight || "w";
  const keyJump = playerObject?.properties.keyJump || "p";
  
  // Get Spectrum key mappings
  const leftMapping = getKeyMapping(keyLeft);
  const rightMapping = getKeyMapping(keyRight);
  const jumpMapping = getKeyMapping(keyJump);
  
  // ===== CHECK JUMP KEY =====
  
  // Read jump key
  engine.push(0x01);              // LD BC, port
  engine.push((jumpMapping?.port || 0xDFFE) & 0xff);
  engine.push(((jumpMapping?.port || 0xDFFE) >> 8) & 0xff);
  engine.push(0xed, 0x78);        // IN A, (C)
  
  const jumpBit = jumpMapping?.bit || 0;
  engine.push(0xcb, 0x47 + (jumpBit * 8));  // BIT n, A
  const jrNoJumpPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, skip_jump_init (placeholder)
  
  // Jump key pressed - check if already jumping
  engine.push(0x3a);              // LD A, (isJumping)
  const isJumpingReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xa7);              // AND A
  const jrAlreadyJumpingPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, skip_jump_init (placeholder)
  
  // Start jump - set isJumping = 1
  engine.push(0x3e, 0x01);        // LD A, 1
  engine.push(0x32);              // LD (isJumping), A
  const isJumpingWriteIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Reset jumpFrameIndex to 0
  engine.push(0xaf);              // XOR A
  engine.push(0x32);              // LD (jumpFrameIndex), A
  const jumpFrameIdxWriteIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0x3e, 0x04);        // LD A, 4
  engine.push(0xd3, 0xfe);        // OUT (254), A (border green - jump started)
  
  // Skip jump initialization
  const skipJumpInitPos = engine.length;
  
  // ===== PROCESS JUMP IF ACTIVE =====
  
  // Check if currently jumping
  engine.push(0x3a);              // LD A, (isJumping)
  const isJumpingReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xa7);              // AND A
  const jrNotJumpingPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, check_right_key (placeholder)
  
  // Read current jump frame index
  engine.push(0x3a);              // LD A, (jumpFrameIndex)
  const jumpFrameIdxReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Check if past trajectory (frame >= 18)
  engine.push(0xfe, 0x12);        // CP 18
  const jrPastTrajectoryPos = engine.length;
  engine.push(0x30, 0x00);        // JR NC, land_check (placeholder)
  
  // Look up trajectory value
  // HL = trajectory_table + jumpFrameIndex
  engine.push(0x21);              // LD HL, trajectory_table
  const trajectoryTableAddrIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x5f);              // LD E, A
  engine.push(0x16, 0x00);        // LD D, 0
  engine.push(0x19);              // ADD HL, DE
  
  // Read trajectory offset (signed byte)
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x47);              // LD B, A (save trajectory)
  
  // Add to playerY
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x80);              // ADD A, B
  engine.push(0x32);              // LD (playerY), A
  const playerYWriteIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Increment jump frame index
  engine.push(0x3a);              // LD A, (jumpFrameIndex)
  const jumpFrameIdxReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x3c);              // INC A
  engine.push(0x32);              // LD (jumpFrameIndex), A
  const jumpFrameIdxWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  const jrToCheckRightPos = engine.length;
  engine.push(0x18, 0x00);        // JR check_right_key (placeholder)
  
  // Land check - check collision with blocks or ground
  const landCheckPos = engine.length;
  
  // Calculate player's foot position (Y + 8 pixels for sprite height)
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xc6, 0x08);        // ADD A, 8 (foot position)
  engine.push(0x47);              // LD B, A (save foot Y in B)
  
  // Convert to tile Y coordinate (divide by 8)
  engine.push(0xcb, 0x3f);        // SRL A (divide by 2)
  engine.push(0xcb, 0x3f);        // SRL A (divide by 4)
  engine.push(0xcb, 0x3f);        // SRL A (divide by 8)
  engine.push(0x4f);              // LD C, A (tile Y in C)
  
  // Get player X and convert to tile coordinate
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx4 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xcb, 0x3f);        // SRL A (divide by 2)
  engine.push(0xcb, 0x3f);        // SRL A (divide by 4)
  engine.push(0xcb, 0x3f);        // SRL A (divide by 8)
  engine.push(0x57);              // LD D, A (tile X in D)
  
  // Search through tile array for solid block at (D, C) position
  // Load screen bank address
  engine.push(0x21);              // LD HL, screenBankAddr
  const screenBankAddrIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Skip to tile array: pointer(2) + width(1) + height(1) = 4 bytes
  engine.push(0x01, 0x04, 0x00);  // LD BC, 4
  engine.push(0x09);              // ADD HL, BC
  
  // Now HL points to first tile byte in flat array
  // Calculate tile offset: offset = (tileY * 32) + tileX
  // tileY is in C, tileX is in D
  
  // Calculate tileY * 32: shift left 5 times
  engine.push(0x79);              // LD A, C (tile Y)
  engine.push(0xcb, 0x27);        // SLA A (x2)
  engine.push(0xcb, 0x27);        // SLA A (x4)
  engine.push(0xcb, 0x27);        // SLA A (x8)
  engine.push(0xcb, 0x27);        // SLA A (x16)
  engine.push(0xcb, 0x27);        // SLA A (x32)
  engine.push(0x5f);              // LD E, A
  engine.push(0x16, 0x00);        // LD D, 0 (DE = tileY * 32)
  
  // Add tileX (in D originally, need to move)
  engine.push(0x7a);              // LD A, D (tile X)
  engine.push(0x83);              // ADD A, E
  engine.push(0x5f);              // LD E, A
  engine.push(0x30, 0x01);        // JR NC, skip_carry
  engine.push(0x14);              // INC D (handle carry)
  // skip_carry:
  
  // Add offset to base address
  engine.push(0x19);              // ADD HL, DE (HL now points to tile at player position)
  
  // Read block index (1 byte) at this position
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x6f);              // LD L, A
  engine.push(0x26, 0x00);        // LD H, 0 (HL = block index)
  
  // Calculate block address: blockBankAddr + 2 + (blockIndex * 5)
  engine.push(0x29);              // ADD HL, HL (blockIndex * 2)
  engine.push(0x54);              // LD D, H
  engine.push(0x5d);              // LD E, L
  engine.push(0x29);              // ADD HL, HL (blockIndex * 4)
  engine.push(0x19);              // ADD HL, DE (blockIndex * 5)
  
  engine.push(0x11);              // LD DE, blockBankAddr + 2
  const blockBankAddrIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x19);              // ADD HL, DE
  
  // Read block type (first byte at block address)
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0x47);              // LD B, A (save block type in B)
  
  // Check if solid (type == 0)
  engine.push(0xa7);              // AND A
  const jrIsSolidPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, land_on_block (placeholder)
  
  // Check if conveyor (type == 2)
  engine.push(0xfe, 0x02);        // CP 2
  const jrIsConveyorPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, land_on_block (placeholder)
  
  // Not a landable block, fall through to ground check
  const jrNotLandablePos = engine.length;
  engine.push(0x18, 0x00);        // JR no_collision (placeholder)
  
  // Landable block found (solid or conveyor)!
  const landOnBlockPos = engine.length;
  
  // Save block address (HL) for reading conveyor properties later
  engine.push(0xe5);              // PUSH HL (save block address)
  
  // Calculate landing Y: tile Y * 8 (shift left 3 times)
  engine.push(0x79);              // LD A, C (tile Y)
  engine.push(0xcb, 0x27);        // SLA A
  engine.push(0xcb, 0x27);        // SLA A
  engine.push(0xcb, 0x27);        // SLA A (now A = tile Y * 8)
  
  // This is the top of the block, player stands on it
  engine.push(0xd6, 0x08);        // SUB 8 (player Y = block top - sprite height)
  engine.push(0x32);              // LD (playerY), A
  const playerYWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Stop jumping
  engine.push(0xaf);              // XOR A
  engine.push(0x32);              // LD (isJumping), A
  const isJumpingWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Check if this is a conveyor block (type == 2)
  engine.push(0x78);              // LD A, B (block type)
  engine.push(0xfe, 0x02);        // CP 2
  const jrNotConveyorPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, skip_conveyor (placeholder)
  
  // It's a conveyor! Read properties and apply push
  // Pop block address from stack (we pushed it earlier)
  engine.push(0xe1);              // POP HL
  
  // HL points to block definition (byte 0 = spriteId, byte 1 = type, byte 2 = flags)
  engine.push(0x23);              // INC HL (skip spriteId)
  engine.push(0x23);              // INC HL (skip type)
  engine.push(0x7e);              // LD A, (HL) (read flags)
  engine.push(0x23);              // INC HL (now at properties)
  
  // Check if HAS_SPEED flag (bit 0) is set
  engine.push(0xcb, 0x47);        // BIT 0, A
  const jrNoConveyorSpeedPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, no_conveyor_push (placeholder)
  
  // Read speed (first property byte, fixed8 format)
  engine.push(0x7e);              // LD A, (HL) (speed)
  engine.push(0x57);              // LD D, A (save speed in D)
  engine.push(0x23);              // INC HL
  
  // Check if HAS_DIRECTION flag (bit 1) is set in flags (need to re-read flags)
  engine.push(0x2b);              // DEC HL
  engine.push(0x2b);              // DEC HL
  engine.push(0x2b);              // DEC HL (back to flags)
  engine.push(0x7e);              // LD A, (HL)
  engine.push(0xcb, 0x4f);        // BIT 1, A
  const jrNoConveyorDirPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, no_conveyor_push (placeholder)
  
  // Read direction (second property byte after speed)
  engine.push(0x23);              // INC HL (to properties)
  engine.push(0x23);              // INC HL (skip speed)
  engine.push(0x7e);              // LD A, (HL) (direction: 0xFF=left, 1=right)
  
  // Apply conveyor push to playerX
  engine.push(0xfe, 0x01);        // CP 1 (check if right)
  const jrConveyorLeftPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, conveyor_left (placeholder)
  
  // Conveyor pushing right
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdxConveyor1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x82);              // ADD A, D (add speed)
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdxConveyor1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  const jrConveyorDonePos = engine.length;
  engine.push(0x18, 0x00);        // JR conveyor_done (placeholder)
  
  // Conveyor pushing left
  const conveyorLeftPos = engine.length;
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdxConveyor2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x92);              // SUB D (subtract speed)
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdxConveyor2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  const conveyorDonePos = engine.length;
  engine.push(0x3e, 0x06);        // LD A, 6
  engine.push(0xd3, 0xfe);        // OUT (254), A (border yellow - on conveyor)
  
  const jrSkipConveyorPos = engine.length;
  engine.push(0x18, 0x00);        // JR skip_conveyor (placeholder)
  
  // Not a conveyor or no push - just pop the saved block address
  const noConveyorPushPos = engine.length;
  engine.push(0xe1);              // POP HL (discard saved block address)
  
  // Skip conveyor logic
  const skipConveyorPos = engine.length;
  engine.push(0x3e, 0x03);        // LD A, 3
  engine.push(0xd3, 0xfe);        // OUT (254), A (border magenta - landed on block)
  
  const jrToCheckRightPos2 = engine.length;
  engine.push(0x18, 0x00);        // JR check_right_key (placeholder)
  
  // No collision found - check ground level
  const noCollisionPos = engine.length;
  
  // Check if Y >= ground level
  engine.push(0x78);              // LD A, B (foot Y from earlier)
  engine.push(0xfe, (playerYPixel + 8) & 0xff);  // CP ground_level + 8
  const jrStillAirbornePos = engine.length;
  engine.push(0x38, 0x00);        // JR C, still_airborne (placeholder)
  
  // Reached ground - land
  engine.push(0x3e, playerYPixel & 0xff);  // LD A, ground_level
  engine.push(0x32);              // LD (playerY), A
  const playerYWriteIdx5 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0xaf);              // XOR A
  engine.push(0x32);              // LD (isJumping), A
  const isJumpingWriteIdx3 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0x3e, 0x00);        // LD A, 0
  engine.push(0xd3, 0xfe);        // OUT (254), A (border black - landed on ground)
  
  const jrToCheckRightPos3 = engine.length;
  engine.push(0x18, 0x00);        // JR check_right_key (placeholder)
  
  // Still airborne - continue falling
  const stillAirbornePos = engine.length;
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx3 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xc6, 0x04);        // ADD A, 4 (fall faster)
  engine.push(0x32);              // LD (playerY), A
  const playerYWriteIdx3 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // ===== CHECK HORIZONTAL MOVEMENT =====
  const checkRightKeyPos = engine.length;
  
  // Apply current horizontal velocity first
  engine.push(0x3a);              // LD A, (playerVelX)
  const playerVelXReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Check if velocity is zero
  engine.push(0xa7);              // AND A
  const jrNoVelocityPos = engine.length;
  engine.push(0x28, 0x00);        // JR Z, check_keys (placeholder)
  
  // Check if velocity is positive (moving right)
  engine.push(0xfe, 0x01);        // CP 1
  const jrNotMovingRightPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, check_left_vel (placeholder)
  
  // Moving right - apply velocity
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xc6, 0x03);        // ADD A, 3 (velocity in pixels/frame)
  
  // Check right boundary (248 = 256 - 8 for sprite width)
  engine.push(0xfe, 0xf8);        // CP 248
  const jrNoWrapRightPos = engine.length;
  engine.push(0x38, 0x00);        // JR C, no_wrap_right (placeholder)
  
  // Wrapped off right edge - wrap to left (X = 0)
  engine.push(0x3e, 0x00);        // LD A, 0
  
  const noWrapRightPos = engine.length;
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  const jrCheckKeysPos = engine.length;
  engine.push(0x18, 0x00);        // JR check_keys (placeholder)
  
  // Check if moving left
  const checkLeftVelPos = engine.length;
  engine.push(0x3a);              // LD A, (playerVelX)
  const playerVelXReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xfe, 0xff);        // CP 255 (-1 as unsigned byte)
  const jrCheckKeysPos2 = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, check_keys (placeholder)
  
  // Moving left - apply velocity
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xd6, 0x03);        // SUB 3 (velocity in pixels/frame)
  
  // Check left boundary (wrapped if A > 248, since SUB caused underflow)
  engine.push(0xfe, 0xf8);        // CP 248
  const jrNoWrapLeftPos = engine.length;
  engine.push(0x38, 0x00);        // JR C, no_wrap_left (placeholder)
  
  // Wrapped off left edge - wrap to right (X = 248)
  engine.push(0x3e, 0xf8);        // LD A, 248
  
  const noWrapLeftPos = engine.length;
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Now check keyboard input to update velocity
  const checkKeysPos = engine.length;
  
  // Read keyboard for right key
  engine.push(0x01);              // LD BC, port
  engine.push((rightMapping?.port || 0xFBFE) & 0xff);
  engine.push(((rightMapping?.port || 0xFBFE) >> 8) & 0xff);
  engine.push(0xed, 0x78);        // IN A, (C)
  
  // Check right key
  const rightBit = rightMapping?.bit || 1;
  engine.push(0xcb, 0x47 + (rightBit * 8));  // BIT n, A
  const jrNoRightPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, check_left (placeholder)
  
  // Right key pressed - set velocity to right (1)
  engine.push(0x3e, 0x01);        // LD A, 1
  engine.push(0x32);              // LD (playerVelX), A
  const playerVelXWriteIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x3e, 0x02);        // LD A, 2
  engine.push(0xd3, 0xfe);        // OUT (254), A (border red)
  
  const jrToDrawPos = engine.length;
  engine.push(0x18, 0x00);        // JR draw_player (placeholder)
  
  
  // Check left key
  const checkLeftPos = engine.length;
  
  // Read keyboard for left key (may be different port)
  engine.push(0x01);              // LD BC, port
  engine.push((leftMapping?.port || 0xFBFE) & 0xff);
  engine.push(((leftMapping?.port || 0xFBFE) >> 8) & 0xff);
  engine.push(0xed, 0x78);        // IN A, (C)
  
  const leftBit = leftMapping?.bit || 0;
  engine.push(0xcb, 0x47 + (leftBit * 8));  // BIT n, A
  const jrNoLeftPos = engine.length;
  engine.push(0x20, 0x00);        // JR NZ, check_no_key (placeholder)
  
  // Left key pressed - set velocity to left (-1)
  engine.push(0x3e, 0xff);        // LD A, 255 (-1 as unsigned byte)
  engine.push(0x32);              // LD (playerVelX), A
  const playerVelXWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x3e, 0x05);        // LD A, 5
  engine.push(0xd3, 0xfe);        // OUT (254), A (border cyan)
  
  const jrToDrawPos2 = engine.length;
  engine.push(0x18, 0x00);        // JR draw_player (placeholder)
  
  // No keys pressed - set velocity to zero
  const checkNoKeyPos = engine.length;
  engine.push(0xaf);              // XOR A (A = 0)
  engine.push(0x32);              // LD (playerVelX), A
  const playerVelXWriteIdx3 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Draw player at current position
  const noKeyPos = engine.length;
  const drawPlayerPos = engine.length;
  
  // Load player X position
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx3 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x4f);              // LD C, A (save X in C)
  
  // Load player Y position (dynamic)
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx4 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Calculate screen address for Y position
  engine.push(0xe6, 0xc0);        // AND 192
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0x67);              // LD H, A
  
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx5 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xe6, 0x07);        // AND 7
  engine.push(0xb4);              // OR H
  engine.push(0xc6, 0x40);        // ADD A, 64
  engine.push(0x67);              // LD H, A
  
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx6 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xe6, 0x38);        // AND 56
  engine.push(0xcb, 0x27);        // SLA A
  engine.push(0xcb, 0x27);        // SLA A
  engine.push(0x6f);              // LD L, A
  
  engine.push(0x79);              // LD A, C (X)
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0xcb, 0x3f);        // SRL A
  engine.push(0x85);              // ADD A, L
  engine.push(0x6f);              // LD L, A
  
  // Draw white pixel
  engine.push(0x36, 0xff);        // LD (HL), 255
  
  // Small delay
  engine.push(0x06, 0x1e);        // LD B, 30
  const delayLoopPos = engine.length;
  engine.push(0x10, 0xfe);        // DJNZ -2
  
  // Loop back to game loop
  const gameLoopOffset = gameLoopAddr - (32768 + engine.length + 2);
  engine.push(0x18, gameLoopOffset & 0xff);  // JR game_loop
  
  // ===== DATA AREA =====
  
  // Manic Miner jump trajectory table (18 frames)
  const trajectoryTableAddr = 32768 + engine.length;
  const jumpTrajectory = [
    -4, -4, -3, -3, -2, -2, -1, -1, 0, 0,  // Ascent
    1, 1, 2, 2, 3, 3, 4, 4                 // Descent
  ];
  jumpTrajectory.forEach(offset => {
    engine.push(offset < 0 ? 256 + offset : offset);  // Convert to unsigned byte
  });
  
  // Player X variable
  const playerXVarAddr = 32768 + engine.length;
  engine.push(playerXPixel & 0xff);
  
  // Player Y variable
  const playerYVarAddr = 32768 + engine.length;
  engine.push(playerYPixel & 0xff);
  
  // IsJumping variable
  const isJumpingVarAddr = 32768 + engine.length;
  engine.push(0x00);
  
  // JumpFrameIndex variable
  const jumpFrameIdxVarAddr = 32768 + engine.length;
  engine.push(0x00);
  
  // Player velocity X variable (-1 = left, 0 = stationary, 1 = right)
  const playerVelXVarAddr = 32768 + engine.length;
  engine.push(0x00);
  
  // Sprite width variable
  const spriteWidthVarAddr = 32768 + engine.length;
  engine.push(0x08);
  
  // Sprite height variable
  const spriteHeightVarAddr = 32768 + engine.length;
  engine.push(0x08);
  
  // ===== PATCH ALL ADDRESS PLACEHOLDERS =====
  
  // Patch screen bank address
  engine[screenBankAddrIdx] = screenBankAddr & 0xff;
  engine[screenBankAddrIdx + 1] = (screenBankAddr >> 8) & 0xff;
  
  // Patch block bank address
  const blockBankWithOffset = blockBankAddr + 2;
  engine[blockBankAddrIdx] = blockBankWithOffset & 0xff;
  engine[blockBankAddrIdx + 1] = (blockBankWithOffset >> 8) & 0xff;
  
  // Patch sprite bank addresses
  const spriteBankWithOffset = spriteBankAddr + 2;
  engine[spriteBankAddrIdx] = spriteBankWithOffset & 0xff;
  engine[spriteBankAddrIdx + 1] = (spriteBankWithOffset >> 8) & 0xff;
  
  engine[spriteBankAddrIdx2] = spriteBankAddr & 0xff;
  engine[spriteBankAddrIdx2 + 1] = (spriteBankAddr >> 8) & 0xff;
  
  // Patch sprite width/height addresses
  engine[spriteWidthAddr] = spriteWidthVarAddr & 0xff;
  engine[spriteWidthAddr + 1] = (spriteWidthVarAddr >> 8) & 0xff;
  
  engine[spriteHeightAddr] = spriteHeightVarAddr & 0xff;
  engine[spriteHeightAddr + 1] = (spriteHeightVarAddr >> 8) & 0xff;
  
  // Patch screen bank address (collision detection)
  engine[screenBankAddrIdx2] = screenBankAddr & 0xff;
  engine[screenBankAddrIdx2 + 1] = (screenBankAddr >> 8) & 0xff;
  
  // Patch block bank address (collision detection)
  const blockBankWithOffset2 = blockBankAddr + 2;
  engine[blockBankAddrIdx2] = blockBankWithOffset2 & 0xff;
  engine[blockBankAddrIdx2 + 1] = (blockBankWithOffset2 >> 8) & 0xff;
  
  // Patch trajectory table address
  engine[trajectoryTableAddrIdx] = trajectoryTableAddr & 0xff;
  engine[trajectoryTableAddrIdx + 1] = (trajectoryTableAddr >> 8) & 0xff;
  
  // Patch player X variable addresses
  engine[playerXVarIdx] = playerXVarAddr & 0xff;
  engine[playerXVarIdx + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdx1] = playerXVarAddr & 0xff;
  engine[playerXReadIdx1 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXWriteIdx1] = playerXVarAddr & 0xff;
  engine[playerXWriteIdx1 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdx2] = playerXVarAddr & 0xff;
  engine[playerXReadIdx2 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXWriteIdx2] = playerXVarAddr & 0xff;
  engine[playerXWriteIdx2 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdx3] = playerXVarAddr & 0xff;
  engine[playerXReadIdx3 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdx4] = playerXVarAddr & 0xff;
  engine[playerXReadIdx4 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdxConveyor1] = playerXVarAddr & 0xff;
  engine[playerXReadIdxConveyor1 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXWriteIdxConveyor1] = playerXVarAddr & 0xff;
  engine[playerXWriteIdxConveyor1 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXReadIdxConveyor2] = playerXVarAddr & 0xff;
  engine[playerXReadIdxConveyor2 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  engine[playerXWriteIdxConveyor2] = playerXVarAddr & 0xff;
  engine[playerXWriteIdxConveyor2 + 1] = (playerXVarAddr >> 8) & 0xff;
  
  // Patch player velocity X variable addresses
  engine[playerVelXReadIdx1] = playerVelXVarAddr & 0xff;
  engine[playerVelXReadIdx1 + 1] = (playerVelXVarAddr >> 8) & 0xff;
  
  engine[playerVelXReadIdx2] = playerVelXVarAddr & 0xff;
  engine[playerVelXReadIdx2 + 1] = (playerVelXVarAddr >> 8) & 0xff;
  
  engine[playerVelXWriteIdx1] = playerVelXVarAddr & 0xff;
  engine[playerVelXWriteIdx1 + 1] = (playerVelXVarAddr >> 8) & 0xff;
  
  engine[playerVelXWriteIdx2] = playerVelXVarAddr & 0xff;
  engine[playerVelXWriteIdx2 + 1] = (playerVelXVarAddr >> 8) & 0xff;
  
  engine[playerVelXWriteIdx3] = playerVelXVarAddr & 0xff;
  engine[playerVelXWriteIdx3 + 1] = (playerVelXVarAddr >> 8) & 0xff;
  
  // Patch player Y variable addresses
  engine[playerYVarIdx] = playerYVarAddr & 0xff;
  engine[playerYVarIdx + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx1] = playerYVarAddr & 0xff;
  engine[playerYReadIdx1 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYWriteIdx1] = playerYVarAddr & 0xff;
  engine[playerYWriteIdx1 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx2] = playerYVarAddr & 0xff;
  engine[playerYReadIdx2 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYWriteIdx2] = playerYVarAddr & 0xff;
  engine[playerYWriteIdx2 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx3] = playerYVarAddr & 0xff;
  engine[playerYReadIdx3 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYWriteIdx3] = playerYVarAddr & 0xff;
  engine[playerYWriteIdx3 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx4] = playerYVarAddr & 0xff;
  engine[playerYReadIdx4 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx5] = playerYVarAddr & 0xff;
  engine[playerYReadIdx5 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYWriteIdx5] = playerYVarAddr & 0xff;
  engine[playerYWriteIdx5 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx6] = playerYVarAddr & 0xff;
  engine[playerYReadIdx6 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  // Patch isJumping variable addresses
  engine[isJumpingVarIdx] = isJumpingVarAddr & 0xff;
  engine[isJumpingVarIdx + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  engine[isJumpingReadIdx1] = isJumpingVarAddr & 0xff;
  engine[isJumpingReadIdx1 + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  engine[isJumpingWriteIdx1] = isJumpingVarAddr & 0xff;
  engine[isJumpingWriteIdx1 + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  engine[isJumpingReadIdx2] = isJumpingVarAddr & 0xff;
  engine[isJumpingReadIdx2 + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  engine[isJumpingWriteIdx2] = isJumpingVarAddr & 0xff;
  engine[isJumpingWriteIdx2 + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  engine[isJumpingWriteIdx3] = isJumpingVarAddr & 0xff;
  engine[isJumpingWriteIdx3 + 1] = (isJumpingVarAddr >> 8) & 0xff;
  
  // Patch jumpFrameIndex variable addresses
  engine[jumpFrameIdxVarIdx] = jumpFrameIdxVarAddr & 0xff;
  engine[jumpFrameIdxVarIdx + 1] = (jumpFrameIdxVarAddr >> 8) & 0xff;
  
  engine[jumpFrameIdxWriteIdx1] = jumpFrameIdxVarAddr & 0xff;
  engine[jumpFrameIdxWriteIdx1 + 1] = (jumpFrameIdxVarAddr >> 8) & 0xff;
  
  engine[jumpFrameIdxReadIdx1] = jumpFrameIdxVarAddr & 0xff;
  engine[jumpFrameIdxReadIdx1 + 1] = (jumpFrameIdxVarAddr >> 8) & 0xff;
  
  engine[jumpFrameIdxReadIdx2] = jumpFrameIdxVarAddr & 0xff;
  engine[jumpFrameIdxReadIdx2 + 1] = (jumpFrameIdxVarAddr >> 8) & 0xff;
  
  engine[jumpFrameIdxWriteIdx2] = jumpFrameIdxVarAddr & 0xff;
  engine[jumpFrameIdxWriteIdx2 + 1] = (jumpFrameIdxVarAddr >> 8) & 0xff;
  
  // Patch jump offsets
  const skipJumpInitAddr = 32768 + skipJumpInitPos;
  const checkRightKeyAddr = 32768 + checkRightKeyPos;
  const landCheckAddr = 32768 + landCheckPos;
  const noCollisionAddr = 32768 + noCollisionPos;
  const stillAirborneAddr = 32768 + stillAirbornePos;
  const checkLeftVelAddr = 32768 + checkLeftVelPos;
  const checkKeysAddr = 32768 + checkKeysPos;
  const noWrapRightAddr = 32768 + noWrapRightPos;
  const noWrapLeftAddr = 32768 + noWrapLeftPos;
  const checkLeftAddr = 32768 + checkLeftPos;
  const checkNoKeyAddr = 32768 + checkNoKeyPos;
  const drawPlayerAddr = 32768 + drawPlayerPos;
  const noKeyAddr = 32768 + noKeyPos;
  const playerSetupAddr = 32768 + playerSetupPos;
  const landOnBlockAddr = 32768 + landOnBlockPos;
  const skipConveyorAddr = 32768 + skipConveyorPos;
  const noConveyorPushAddr = 32768 + noConveyorPushPos;
  const conveyorLeftAddr = 32768 + conveyorLeftPos;
  const conveyorDoneAddr = 32768 + conveyorDonePos;
  
  let disp = skipJumpInitAddr - (32768 + jrNoJumpPos + 2);
  engine[jrNoJumpPos + 1] = disp & 0xff;
  
  disp = skipJumpInitAddr - (32768 + jrAlreadyJumpingPos + 2);
  engine[jrAlreadyJumpingPos + 1] = disp & 0xff;
  
  disp = checkRightKeyAddr - (32768 + jrNotJumpingPos + 2);
  engine[jrNotJumpingPos + 1] = disp & 0xff;
  
  disp = landCheckAddr - (32768 + jrPastTrajectoryPos + 2);
  engine[jrPastTrajectoryPos + 1] = disp & 0xff;
  
  disp = checkRightKeyAddr - (32768 + jrToCheckRightPos + 2);
  engine[jrToCheckRightPos + 1] = disp & 0xff;
  
  // Conveyor landing jumps
  disp = landOnBlockAddr - (32768 + jrIsSolidPos + 2);
  engine[jrIsSolidPos + 1] = disp & 0xff;
  
  disp = landOnBlockAddr - (32768 + jrIsConveyorPos + 2);
  engine[jrIsConveyorPos + 1] = disp & 0xff;
  
  disp = noCollisionAddr - (32768 + jrNotLandablePos + 2);
  engine[jrNotLandablePos + 1] = disp & 0xff;
  
  disp = skipConveyorAddr - (32768 + jrNotConveyorPos + 2);
  engine[jrNotConveyorPos + 1] = disp & 0xff;
  
  disp = noConveyorPushAddr - (32768 + jrNoConveyorSpeedPos + 2);
  engine[jrNoConveyorSpeedPos + 1] = disp & 0xff;
  
  disp = noConveyorPushAddr - (32768 + jrNoConveyorDirPos + 2);
  engine[jrNoConveyorDirPos + 1] = disp & 0xff;
  
  disp = conveyorLeftAddr - (32768 + jrConveyorLeftPos + 2);
  engine[jrConveyorLeftPos + 1] = disp & 0xff;
  
  disp = conveyorDoneAddr - (32768 + jrConveyorDonePos + 2);
  engine[jrConveyorDonePos + 1] = disp & 0xff;
  
  disp = skipConveyorAddr - (32768 + jrSkipConveyorPos + 2);
  engine[jrSkipConveyorPos + 1] = disp & 0xff;
  
  disp = checkRightKeyAddr - (32768 + jrToCheckRightPos2 + 2);
  engine[jrToCheckRightPos2 + 1] = disp & 0xff;
  
  disp = stillAirborneAddr - (32768 + jrStillAirbornePos + 2);
  engine[jrStillAirbornePos + 1] = disp & 0xff;
  
  disp = checkRightKeyAddr - (32768 + jrToCheckRightPos3 + 2);
  engine[jrToCheckRightPos3 + 1] = disp & 0xff;
  
  // Velocity persistence jumps
  disp = checkKeysAddr - (32768 + jrNoVelocityPos + 2);
  engine[jrNoVelocityPos + 1] = disp & 0xff;
  
  disp = checkLeftVelAddr - (32768 + jrNotMovingRightPos + 2);
  engine[jrNotMovingRightPos + 1] = disp & 0xff;
  
  disp = checkKeysAddr - (32768 + jrCheckKeysPos + 2);
  engine[jrCheckKeysPos + 1] = disp & 0xff;
  
  disp = checkKeysAddr - (32768 + jrCheckKeysPos2 + 2);
  engine[jrCheckKeysPos2 + 1] = disp & 0xff;
  
  // Boundary wrapping jumps
  disp = noWrapRightAddr - (32768 + jrNoWrapRightPos + 2);
  engine[jrNoWrapRightPos + 1] = disp & 0xff;
  
  disp = noWrapLeftAddr - (32768 + jrNoWrapLeftPos + 2);
  engine[jrNoWrapLeftPos + 1] = disp & 0xff;
  
  disp = checkLeftAddr - (32768 + jrNoRightPos + 2);
  engine[jrNoRightPos + 1] = disp & 0xff;
  
  disp = drawPlayerAddr - (32768 + jrToDrawPos + 2);
  engine[jrToDrawPos + 1] = disp & 0xff;
  
  disp = checkNoKeyAddr - (32768 + jrNoLeftPos + 2);
  engine[jrNoLeftPos + 1] = disp & 0xff;
  
  disp = drawPlayerAddr - (32768 + jrToDrawPos2 + 2);
  engine[jrToDrawPos2 + 1] = disp & 0xff;
  
  disp = playerSetupAddr - (32768 + jzToPlayerSetup + 2);
  engine[jzToPlayerSetup + 1] = disp & 0xff;
  
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
