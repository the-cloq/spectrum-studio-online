// Main Spectrum export orchestrator
// Converts GameProject to binary/assembly and generates TAP file

import { GameProject, Sprite } from "@/types/spectrum";
import { TAPGenerator } from "./tapGenerator";
import { packBlockBank, generateBlockBankAsm } from "./blockPacker";
import { packObjectBank, generateObjectBankAsm } from "./objectPacker";
import { packScreenBank, generateScreenBankAsm } from "./screenPacker";
import { BinaryPacker } from "./binaryPacker";

export interface ExportOptions {
  generateAsm?: boolean;      // Generate .asm assembly files
  includeBinary?: boolean;     // Include binary data in TAP
  optimizeSize?: boolean;      // Apply size optimizations
}

export interface ExportResult {
  tapBlob: Blob;
  asmCode?: string;
  binaryData?: Uint8Array;
  stats: {
    blockBankSize: number;
    objectBankSize: number;
    screenBankSize: number;
    totalSize: number;
  };
}

// Build index maps (ID → index) for all game elements
function buildIndexMaps(project: GameProject) {
  const spriteIndexMap = new Map<string, number>();
  const blockIndexMap = new Map<string, number>();
  const objectIndexMap = new Map<string, number>();
  
  project.sprites?.forEach((sprite, idx) => {
    spriteIndexMap.set(sprite.id, idx);
  });
  
  project.blocks?.forEach((block, idx) => {
    blockIndexMap.set(block.id, idx);
  });
  
  project.objects?.forEach((obj, idx) => {
    objectIndexMap.set(obj.id, idx);
  });
  
  return { spriteIndexMap, blockIndexMap, objectIndexMap };
}

// Main export function
export function exportToSpectrum(
  project: GameProject,
  options: ExportOptions = {}
): ExportResult {
  const { generateAsm = false, includeBinary = true } = options;
  
  // Build index maps
  const { spriteIndexMap, blockIndexMap, objectIndexMap } = buildIndexMaps(project);
  
  // Pack all data banks
  const blockBankData = packBlockBank(project.blocks || [], spriteIndexMap);
  const objectBankData = packObjectBank(project.objects || [], spriteIndexMap);
  
  // Get screens from levels (game flow sequence)
  const screens = project.screens || [];
  const screenBankData = packScreenBank(
    screens,
    blockIndexMap,
    objectIndexMap,
    project.objects || []
  );
  
  // Calculate sizes
  const stats = {
    blockBankSize: blockBankData.length,
    objectBankSize: objectBankData.length,
    screenBankSize: screenBankData.length,
    totalSize: blockBankData.length + objectBankData.length + screenBankData.length,
  };
  
  // Generate assembly code if requested
  let asmCode: string | undefined;
  if (generateAsm) {
    asmCode = generateFullAssembly(project, spriteIndexMap, blockIndexMap, objectIndexMap);
  }
  
  // Generate TAP file
  const tapBlob = generateTAP(
    project,
    blockBankData,
    objectBankData,
    screenBankData
  );
  
  // Combine all binary data
  const binaryData = includeBinary ? combineBinaryData(
    blockBankData,
    objectBankData,
    screenBankData
  ) : undefined;
  
  return {
    tapBlob,
    asmCode,
    binaryData,
    stats,
  };
}

// Combine all binary banks into single data blob
function combineBinaryData(
  blockBank: Uint8Array,
  objectBank: Uint8Array,
  screenBank: Uint8Array
): Uint8Array {
  const totalSize = blockBank.length + objectBank.length + screenBank.length;
  const combined = new Uint8Array(totalSize);
  
  let offset = 0;
  combined.set(blockBank, offset);
  offset += blockBank.length;
  combined.set(objectBank, offset);
  offset += objectBank.length;
  combined.set(screenBank, offset);
  
  return combined;
}

// Generate complete assembly file
function generateFullAssembly(
  project: GameProject,
  spriteIndexMap: Map<string, number>,
  blockIndexMap: Map<string, number>,
  objectIndexMap: Map<string, number>
): string {
  let asm = `; ZX Spectrum Game Export\n`;
  asm += `; Project: ${project.name}\n`;
  asm += `; Generated: ${new Date().toISOString()}\n\n`;
  
  asm += `    org 32768  ; Start at 0x8000\n\n`;
  
  // Include block bank
  asm += generateBlockBankAsm(project.blocks || [], spriteIndexMap);
  asm += "\n";
  
  // Include object bank
  asm += generateObjectBankAsm(project.objects || [], spriteIndexMap);
  asm += "\n";
  
  // Include screen bank
  asm += generateScreenBankAsm(
    project.screens || [],
    blockIndexMap,
    objectIndexMap,
    project.objects || []
  );
  asm += "\n";
  
  // Include game engine stub
  asm += generateGameEngineStub();
  
  return asm;
}

// Generate a minimal Z80 game engine stub
function generateGameEngineStub(): string {
  return `; Game Engine Entry Point
GameStart:
    ; Set border color
    ld a, 0
    out (254), a
    
    ; Clear screen
    call ClearScreen
    
    ; Load first screen
    ld hl, ScreenBank
    call LoadScreen
    
    ; Main game loop
GameLoop:
    ; Read keyboard
    call ReadKeyboard
    
    ; Update game logic
    call UpdateGame
    
    ; Render frame
    call RenderFrame
    
    ; Loop
    jr GameLoop

; Clear screen routine
ClearScreen:
    ld hl, 16384
    ld de, 16385
    ld bc, 6143
    ld (hl), 0
    ldir
    ret

; Placeholder routines (to be implemented)
LoadScreen:
    ret

ReadKeyboard:
    ret

UpdateGame:
    ret

RenderFrame:
    ret

    end GameStart
`;
}

// Generate TAP file with all game data
function generateTAP(
  project: GameProject,
  blockBank: Uint8Array,
  objectBank: Uint8Array,
  screenBank: Uint8Array
): Blob {
  const tap = new TAPGenerator();
  
  // Combine all data
  const gameData = Array.from(combineBinaryData(blockBank, objectBank, screenBank));
  
  // Add BASIC loader
  tap.addBasicLoader(gameData.length, 32768);
  
  // Add CODE header
  tap.addHeader(project.name.substring(0, 10), gameData.length);
  
  // Add CODE data block
  tap.addDataBlock(gameData);
  
  return tap.toBlob();
}

// Download helper
export function downloadSpectrumExport(
  result: ExportResult,
  projectName: string
) {
  // Download TAP file
  const tapUrl = URL.createObjectURL(result.tapBlob);
  const tapLink = document.createElement("a");
  tapLink.href = tapUrl;
  tapLink.download = `${projectName}.tap`;
  document.body.appendChild(tapLink);
  tapLink.click();
  document.body.removeChild(tapLink);
  URL.revokeObjectURL(tapUrl);
  
  // Download ASM file if available
  if (result.asmCode) {
    const asmBlob = new Blob([result.asmCode], { type: "text/plain" });
    const asmUrl = URL.createObjectURL(asmBlob);
    const asmLink = document.createElement("a");
    asmLink.href = asmUrl;
    asmLink.download = `${projectName}.asm`;
    document.body.appendChild(asmLink);
    asmLink.click();
    document.body.removeChild(asmLink);
    URL.revokeObjectURL(asmUrl);
  }
  
  // Download binary data if available
  if (result.binaryData) {
    const binBlob = new Blob([result.binaryData as BlobPart], { type: "application/octet-stream" });
    const binUrl = URL.createObjectURL(binBlob);
    const binLink = document.createElement("a");
    binLink.href = binUrl;
    binLink.download = `${projectName}.bin`;
    document.body.appendChild(binLink);
    binLink.click();
    document.body.removeChild(binLink);
    URL.revokeObjectURL(binUrl);
  }
}
