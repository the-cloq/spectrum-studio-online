import { TAPGenerator } from "./tapGenerator";
import { type Screen, type GameFlowScreen, type Level, SPECTRUM_COLORS } from "@/types/spectrum";

/**
 * Export Game Flow to TAP file
 * Includes loading screens, title screens with keyboard menus, and level data
 */
export function exportGameFlowToTAP(
  gameFlow: GameFlowScreen[],
  screens: Screen[],
  levels: Level[],
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

  const loadingScr = encodeScreenToSCR(loadingScreen);
  const targetScr = encodeScreenToSCR(targetScreen);

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

  // Build simple Z80 engine at 32768 that copies the target screen into screen memory
  // and then loops forever so control never returns to BASIC (no "0 OK" prompt).
  const engine: number[] = [];
  const engineStart = 32768;

  // LD HL, <targetScreenAddress> (patched below)
  const hlIndex = engine.length;
  engine.push(0x21, 0x00, 0x00);

  // LD DE, 16384 (screen memory)
  engine.push(0x11, 0x00, 0x40);

  // LD BC, 6912 (screen bytes)
  engine.push(0x01, 0x00, 0x1b);

  // LDIR
  engine.push(0xed, 0xb0);

  // Infinite loop: HALT : JR $
  engine.push(0x76); // HALT
  engine.push(0x18, 0xfe); // JR -2

  // Patch HL with address of target screen data (immediately after engine)
  const targetScreenAddress = engineStart + engine.length;
  engine[hlIndex + 1] = targetScreenAddress & 0xff;
  engine[hlIndex + 2] = (targetScreenAddress >> 8) & 0xff;

  const codeData = [...engine, ...targetScr];

  const codeName = "GameFlow  ";
  tap.addHeader(codeName, codeData.length, engineStart);
  tap.addDataBlock(codeData);

  return tap.toBlob();
}

/**
 * Encode a screen to ZX Spectrum SCR format (6912 bytes)
 */
function encodeScreenToSCR(screen: Screen): number[] {
  const scrData = new Array(6912).fill(0);

  if (!screen.pixels) return scrData;

  // Encode screen in ZX Spectrum format
  for (let by = 0; by < 192; by += 8) {
    for (let bx = 0; bx < 256; bx += 8) {
      // Find the two colors in this 8x8 block
      const colors = new Set<string>();
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const px = bx + x;
          const py = by + y;
          if (py < 192 && px < 256 && screen.pixels[py]?.[px]) {
            colors.add(screen.pixels[py][px].value);
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
          const color = screen.pixels[py]?.[px];
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
