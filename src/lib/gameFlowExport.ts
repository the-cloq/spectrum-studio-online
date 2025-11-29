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
  // Screen bank format: screenCount(2) + screens[]
  // Each screen: width(2) height(2) tileCount(2) tiles[] objectCount(2) objects[]
  
  // Load screen bank address
  engine.push(0x21);              // LD HL, screenBankAddr
  const screenBankAddrIdx = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  // Skip screen count (2 bytes) to get to first screen
  engine.push(0x23, 0x23);        // INC HL, INC HL
  
  // Read screen width (not used for now)
  engine.push(0x23, 0x23);        // INC HL, INC HL
  
  // Read screen height (not used for now)
  engine.push(0x23, 0x23);        // INC HL, INC HL
  
  // Read tile count into BC
  engine.push(0x4e);              // LD C, (HL)
  engine.push(0x23);              // INC HL
  engine.push(0x46);              // LD B, (HL)
  engine.push(0x23);              // INC HL
  
  // Now HL points to first tile
  // Tile format: x(2) y(2) blockIndex(2) = 6 bytes per tile
  
  // Store tile pointer in IX
  engine.push(0xdd, 0xe5);        // PUSH IX
  engine.push(0xdd, 0xe1);        // POP IX (IX = HL)
  
  // ===== TILE RENDERING LOOP =====
  const tileLoopStart = 32768 + engine.length;
  
  // Check if BC == 0 (no more tiles)
  engine.push(0x78);              // LD A, B
  engine.push(0xb1);              // OR C
  const jzToPlayerSetup = engine.length;
  engine.push(0x28, 0x00);        // JR Z, player_setup (placeholder)
  
  // Read tile X position into D
  engine.push(0xdd, 0x56, 0x00);  // LD D, (IX+0)
  
  // Read tile Y position into E
  engine.push(0xdd, 0x5e, 0x02);  // LD E, (IX+2)
  
  // Read block index into HL
  engine.push(0xdd, 0x6e, 0x04);  // LD L, (IX+4)
  engine.push(0xdd, 0x66, 0x05);  // LD H, (IX+5)
  
  // Save BC and IX
  engine.push(0xc5);              // PUSH BC
  engine.push(0xdd, 0xe5);        // PUSH IX
  
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
  // This is a placeholder that draws white blocks
  
  // Calculate screen address for tile at (tileX * 8, tileY * 8)
  // For now, just mark that we've processed this tile
  
  // Move to next tile (advance IX by 6 bytes)
  engine.push(0xdd, 0x23);        // INC IX (6 times)
  engine.push(0xdd, 0x23);
  engine.push(0xdd, 0x23);
  engine.push(0xdd, 0x23);
  engine.push(0xdd, 0x23);
  engine.push(0xdd, 0x23);
  
  // Decrement tile counter
  engine.push(0x0b);              // DEC BC
  
  // Loop back
  let loopOffset = tileLoopStart - (32768 + engine.length + 2);
  engine.push(0x18, loopOffset & 0xff);  // JR tile_loop
  
  // ===== PLAYER SETUP =====
  const playerSetupPos = engine.length;
  
  // Restore IX
  engine.push(0xdd, 0xe1);        // POP IX
  
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
  
  // Land check - check if Y >= ground level
  const landCheckPos = engine.length;
  engine.push(0x3a);              // LD A, (playerY)
  const playerYReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xfe, playerYPixel & 0xff);  // CP ground_level
  const jrStillAirbornePos = engine.length;
  engine.push(0x38, 0x00);        // JR C, still_airborne (placeholder)
  
  // Landed - reset Y to ground and stop jumping
  engine.push(0x3e, playerYPixel & 0xff);  // LD A, ground_level
  engine.push(0x32);              // LD (playerY), A
  const playerYWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0xaf);              // XOR A
  engine.push(0x32);              // LD (isJumping), A
  const isJumpingWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  
  engine.push(0x3e, 0x00);        // LD A, 0
  engine.push(0xd3, 0xfe);        // OUT (254), A (border black - landed)
  
  const jrToCheckRightPos2 = engine.length;
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
  
  // Right key pressed - move right
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx1 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xc6, 0x08);        // ADD A, 8
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdx1 = engine.length;
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
  engine.push(0x20, 0x00);        // JR NZ, no_key (placeholder)
  
  // Left key pressed - move left
  engine.push(0x3a);              // LD A, (playerX)
  const playerXReadIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0xd6, 0x08);        // SUB 8
  engine.push(0x32);              // LD (playerX), A
  const playerXWriteIdx2 = engine.length;
  engine.push(0x00, 0x00);        // Placeholder
  engine.push(0x3e, 0x05);        // LD A, 5
  engine.push(0xd3, 0xfe);        // OUT (254), A (border cyan)
  
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
  loopOffset = gameLoopAddr - (32768 + engine.length + 2);
  engine.push(0x18, loopOffset & 0xff);  // JR game_loop
  
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
  
  engine[playerYReadIdx4] = playerYVarAddr & 0xff;
  engine[playerYReadIdx4 + 1] = (playerYVarAddr >> 8) & 0xff;
  
  engine[playerYReadIdx5] = playerYVarAddr & 0xff;
  engine[playerYReadIdx5 + 1] = (playerYVarAddr >> 8) & 0xff;
  
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
  const stillAirborneAddr = 32768 + stillAirbornePos;
  const checkLeftAddr = 32768 + checkLeftPos;
  const drawPlayerAddr = 32768 + drawPlayerPos;
  const noKeyAddr = 32768 + noKeyPos;
  const playerSetupAddr = 32768 + playerSetupPos;
  
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
  
  disp = stillAirborneAddr - (32768 + jrStillAirbornePos + 2);
  engine[jrStillAirbornePos + 1] = disp & 0xff;
  
  disp = checkRightKeyAddr - (32768 + jrToCheckRightPos2 + 2);
  engine[jrToCheckRightPos2 + 1] = disp & 0xff;
  
  disp = checkLeftAddr - (32768 + jrNoRightPos + 2);
  engine[jrNoRightPos + 1] = disp & 0xff;
  
  disp = drawPlayerAddr - (32768 + jrToDrawPos + 2);
  engine[jrToDrawPos + 1] = disp & 0xff;
  
  disp = noKeyAddr - (32768 + jrNoLeftPos + 2);
  engine[jrNoLeftPos + 1] = disp & 0xff;
  
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
