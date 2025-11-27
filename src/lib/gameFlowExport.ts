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
    .filter(screen => screen && screen.pixels);

  if (validFlowScreens.length === 0) {
    return tap.toBlob(); // No valid screens to export
  }

  // Create BASIC loader that loads all screens in sequence
  const basicProgram: number[] = [];
  
  validFlowScreens.forEach((_, index) => {
    const lineNumber = 10 + (index * 10);
    
    // Line N: LOAD "" SCREEN$ (line numbers are big-endian)
    basicProgram.push((lineNumber >> 8) & 0xff, lineNumber & 0xff);
    const lineStart = basicProgram.length;
    basicProgram.push(0x00, 0x00); // Length placeholder
    basicProgram.push(0xef); // LOAD token
    basicProgram.push(0x20); // Space
    basicProgram.push(0x22, 0x22); // Empty string ""
    basicProgram.push(0x20); // Space
    basicProgram.push(0xaa); // SCREEN$ token
    basicProgram.push(0x0d); // ENTER
    const lineLength = basicProgram.length - lineStart - 2;
    basicProgram[lineStart] = lineLength & 0xff;
    basicProgram[lineStart + 1] = (lineLength >> 8) & 0xff;

    // Add PAUSE between screens (except after last screen)
    if (index < validFlowScreens.length - 1) {
      const pauseLineNumber = lineNumber + 5;
      basicProgram.push((pauseLineNumber >> 8) & 0xff, pauseLineNumber & 0xff);
      const pauseLineStart = basicProgram.length;
      basicProgram.push(0x00, 0x00); // Length placeholder
      basicProgram.push(0xf2); // PAUSE token
      basicProgram.push(0x20); // Space
      basicProgram.push(0x35, 0x30); // "50" as ASCII
      basicProgram.push(0x0e, 0x00, 0x00, 0x32, 0x00, 0x00); // Encoded number 50
      basicProgram.push(0x0d); // ENTER
      const pauseLineLength = basicProgram.length - pauseLineStart - 2;
      basicProgram[pauseLineStart] = pauseLineLength & 0xff;
      basicProgram[pauseLineStart + 1] = (pauseLineLength >> 8) & 0xff;
    }
  });

  // BASIC program header
  const headerData: number[] = [0x00, 0x00]; // Header flag, BASIC type
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

  // Add each screen as a CODE block
  validFlowScreens.forEach((screen, index) => {
    const scrData = encodeScreenToSCR(screen);
    const screenName = `Screen${index + 1}`.substring(0, 10).padEnd(10, ' ');
    tap.addHeader(screenName, 6912, 16384);
    tap.addDataBlock(scrData);
  });

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
