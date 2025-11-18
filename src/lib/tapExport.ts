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

  // Create header block
  tap.addHeader(project.name.substring(0, 10), gameData.length);

  // Add data block
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
  // This is a placeholder for a real Z80 game engine
  // A full engine would be several KB of assembly code
  
  const engine: number[] = [
    // Basic ROM calls
    0x3e, 0x02,       // LD A, 2 (channel 2 - screen)
    0xcd, 0x01, 0x16, // CALL 5633 (CHAN_OPEN)
    
    // Clear screen
    0xcd, 0xd6, 0x0d, // CALL 3542 (CLS)
    
    // Main game loop placeholder
    0x3e, 0x00,       // LD A, 0
    0xcd, 0x00, 0x10, // CALL 4096 (our game code would go here)
    
    // Return
    0xc9,             // RET
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
