/**
 * ZX Spectrum keyboard port mappings
 * The Spectrum keyboard is read via IN instructions on specific ports
 * Each port covers a half-row of keys, and specific bits indicate key states
 */

export interface SpectrumKeyMapping {
  port: number;
  bit: number;
  keyName: string;
}

/**
 * Map of keyboard characters to ZX Spectrum port/bit combinations
 * Port values are used with IN A,(C) instruction where BC contains the port
 * Bit 0-4 indicate which key is pressed (0 = pressed, 1 = not pressed)
 */
export const SPECTRUM_KEYBOARD_MAP: Record<string, SpectrumKeyMapping> = {
  // Port 0xFBFE (half-row: CAPS SHIFT, Z, X, C, V)
  'shift': { port: 0xFBFE, bit: 0, keyName: 'CAPS SHIFT' },
  'z': { port: 0xFBFE, bit: 1, keyName: 'Z' },
  'x': { port: 0xFBFE, bit: 2, keyName: 'X' },
  'c': { port: 0xFBFE, bit: 3, keyName: 'C' },
  'v': { port: 0xFBFE, bit: 4, keyName: 'V' },
  
  // Port 0xFDFE (half-row: A, S, D, F, G)
  'a': { port: 0xFDFE, bit: 0, keyName: 'A' },
  's': { port: 0xFDFE, bit: 1, keyName: 'S' },
  'd': { port: 0xFDFE, bit: 2, keyName: 'D' },
  'f': { port: 0xFDFE, bit: 3, keyName: 'F' },
  'g': { port: 0xFDFE, bit: 4, keyName: 'G' },
  
  // Port 0xFBFE (half-row: Q, W, E, R, T)
  'q': { port: 0xFBFE, bit: 0, keyName: 'Q' },
  'w': { port: 0xFBFE, bit: 1, keyName: 'W' },
  'e': { port: 0xFBFE, bit: 2, keyName: 'E' },
  'r': { port: 0xFBFE, bit: 3, keyName: 'R' },
  't': { port: 0xFBFE, bit: 4, keyName: 'T' },
  
  // Port 0xF7FE (half-row: 1, 2, 3, 4, 5)
  '1': { port: 0xF7FE, bit: 0, keyName: '1' },
  '2': { port: 0xF7FE, bit: 1, keyName: '2' },
  '3': { port: 0xF7FE, bit: 2, keyName: '3' },
  '4': { port: 0xF7FE, bit: 3, keyName: '4' },
  '5': { port: 0xF7FE, bit: 4, keyName: '5' },
  
  // Port 0xEFFE (half-row: 0, 9, 8, 7, 6)
  '0': { port: 0xEFFE, bit: 0, keyName: '0' },
  '9': { port: 0xEFFE, bit: 1, keyName: '9' },
  '8': { port: 0xEFFE, bit: 2, keyName: '8' },
  '7': { port: 0xEFFE, bit: 3, keyName: '7' },
  '6': { port: 0xEFFE, bit: 4, keyName: '6' },
  
  // Port 0xDFFE (half-row: P, O, I, U, Y)
  'p': { port: 0xDFFE, bit: 0, keyName: 'P' },
  'o': { port: 0xDFFE, bit: 1, keyName: 'O' },
  'i': { port: 0xDFFE, bit: 2, keyName: 'I' },
  'u': { port: 0xDFFE, bit: 3, keyName: 'U' },
  'y': { port: 0xDFFE, bit: 4, keyName: 'Y' },
  
  // Port 0xBFFE (half-row: ENTER, L, K, J, H)
  'enter': { port: 0xBFFE, bit: 0, keyName: 'ENTER' },
  'l': { port: 0xBFFE, bit: 1, keyName: 'L' },
  'k': { port: 0xBFFE, bit: 2, keyName: 'K' },
  'j': { port: 0xBFFE, bit: 3, keyName: 'J' },
  'h': { port: 0xBFFE, bit: 4, keyName: 'H' },
  
  // Port 0x7FFE (half-row: SPACE, SYMBOL SHIFT, M, N, B)
  'space': { port: 0x7FFE, bit: 0, keyName: 'SPACE' },
  'symbol': { port: 0x7FFE, bit: 1, keyName: 'SYMBOL SHIFT' },
  'm': { port: 0x7FFE, bit: 2, keyName: 'M' },
  'n': { port: 0x7FFE, bit: 3, keyName: 'N' },
  'b': { port: 0x7FFE, bit: 4, keyName: 'B' },
};

/**
 * Get ZX Spectrum port/bit mapping for a key string
 */
export function getKeyMapping(key: string | undefined): SpectrumKeyMapping | null {
  if (!key) return null;
  const normalized = key.toLowerCase().trim();
  return SPECTRUM_KEYBOARD_MAP[normalized] || null;
}

/**
 * Generate Z80 assembly code to read a specific key
 * Returns array of bytes for IN instruction and BIT test
 */
export function generateKeyReadCode(key: string | undefined): number[] {
  const mapping = getKeyMapping(key);
  if (!mapping) {
    // Default to Q key if invalid
    return generateKeyReadCode('q');
  }
  
  const code: number[] = [];
  
  // LD BC, port
  code.push(0x01);  // LD BC, nn
  code.push(mapping.port & 0xff);
  code.push((mapping.port >> 8) & 0xff);
  
  // IN A, (C)
  code.push(0xed, 0x78);
  
  // BIT n, A
  code.push(0xcb);
  code.push(0x47 + (mapping.bit * 8));  // BIT 0-4, A
  
  return code;
}
