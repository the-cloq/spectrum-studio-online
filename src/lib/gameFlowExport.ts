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

  // Collect all screen data
  const screenData: number[] = [];
  
  // Header: number of screens in flow
  screenData.push(sortedFlow.length);

  // Process each screen in the flow
  sortedFlow.forEach((flowScreen, index) => {
    const screen = screens.find(s => s.id === flowScreen.screenId);
    if (!screen) return;

    // Screen header
    screenData.push(screen.type === "loading" ? 0x01 : 0x02); // Type: 1=loading, 2=title/menu
    screenData.push(flowScreen.autoShow ? 1 : 0); // Auto-show flag
    screenData.push(flowScreen.accessKey ? flowScreen.accessKey.charCodeAt(0) : 0); // Access key ASCII

    // Encode screen pixels as SCR data (6912 bytes)
    if (screen.pixels) {
      const scrData = encodeScreenToSCR(screen);
      screenData.push(...scrData);
    } else {
      // Empty screen - fill with zeros
      screenData.push(...new Array(6912).fill(0));
    }

    // Menu text for title screens (max 64 chars)
    if (screen.type === "title" && flowScreen.scrollText) {
      const menuText = flowScreen.scrollText.substring(0, 64);
      screenData.push(menuText.length);
      for (let i = 0; i < menuText.length; i++) {
        screenData.push(menuText.charCodeAt(i));
      }
    } else {
      screenData.push(0); // No menu text
    }
  });

  // Add level data reference
  screenData.push(levels.length); // Number of levels

  // Create the game engine that handles screen flow
  const gameEngine = createGameFlowEngine(sortedFlow, screens, levels);

  // Combine screen data + game engine
  const fullGameData = [...screenData, ...gameEngine];

  // Add BASIC loader
  tap.addBasicLoader(fullGameData.length, 32768);

  // Add game data as CODE block
  tap.addHeader(projectName.substring(0, 10), fullGameData.length);
  tap.addDataBlock(fullGameData);

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
