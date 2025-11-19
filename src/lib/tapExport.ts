import { TAPGenerator, spriteToSpectrumFormat } from "./tapGenerator";
import { type GameProject, type Screen, type Block } from "@/types/spectrum";

// Export a complete game project as a TAP file
export function exportGameToTAP(project: GameProject): Blob {
  const tap = new TAPGenerator();

  // Game data to export
  const gameData: number[] = [];

  // Add screen data
  project.screens.forEach((screen) => {
    const screenData = encodeScreen(screen, project.blocks);
    gameData.push(...screenData);
  });

  // Add a simple loader/game engine
  const gameEngine = createGameEngine(project);
  gameData.push(...gameEngine);

  // Add BASIC loader first (auto-runs the machine code)
  tap.addBasicLoader(gameData.length, 32768);

  // Create CODE header block
  tap.addHeader(project.name.substring(0, 10), gameData.length);

  // Add CODE data block
  tap.addDataBlock(gameData);

  return tap.toBlob();
}

// Encode a screen into Spectrum format
function encodeScreen(screen: Screen, blocks: Block[]): number[] {
  const data: number[] = [];

  // Screen header
  data.push(screen.width); // Width in tiles
  data.push(screen.height); // Height in tiles

  // Encode tile map
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const blockId = screen.tiles[y]?.[x] || "";
      const blockIndex = blocks.findIndex(b => b.id === blockId);
      data.push(blockIndex >= 0 ? blockIndex : 0); // 0 = empty
    }
  }

  return data;
}

// Create a minimal game engine in Z80 machine code
function createGameEngine(project: GameProject): number[] {
  // This creates a basic Z80 program that displays a screen pattern
  // and waits for a key press before returning to BASIC
  
  const engine: number[] = [
    // Set border color to black
    0x3E, 0x00,       // LD A, 0
    0xD3, 0xFE,       // OUT (254), A
    
    // Open channel 2 (screen)
    0x3E, 0x02,       // LD A, 2
    0xCD, 0x01, 0x16, // CALL 5633 (CHAN_OPEN)
    
    // Clear screen
    0xCD, 0xD6, 0x0D, // CALL 3542 (CLS)
    
    // Print a simple message to screen memory
    0x21, 0x00, 0x40, // LD HL, 16384 (start of screen memory)
    0x36, 0xFF,       // LD (HL), 255 (fill with pixels)
    0x23,             // INC HL
    0x36, 0xAA,       // LD (HL), 170
    0x23,             // INC HL
    0x36, 0x55,       // LD (HL), 85
    
    // Set some attribute colors (22528 onwards)
    0x21, 0x00, 0x58, // LD HL, 22528 (start of attributes)
    0x36, 0x47,       // LD (HL), 71 (white on black, bright)
    
    // Wait for key press
    0xCD, 0xBB, 0x15, // CALL 5563 (WAIT_KEY)
    
    // Return to BASIC
    0xC9              // RET
  ];

  return engine;
}

// Download helper
export function downloadTAPFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".tap") ? filename : `${filename}.tap`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
