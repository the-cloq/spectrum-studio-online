// TAP file format utilities for ZX Spectrum
// TAP files contain blocks with: 2-byte length, flag byte, data, checksum

export class TAPGenerator {
  private data: number[] = [];

  // Add a header block (type 0x00)
  addHeader(filename: string, dataLength: number, autoStart: number = 32768) {
    const headerData: number[] = [
      0x00, // Header block flag
      0x03, // Program file type (CODE)
    ];

    // Filename (10 bytes, padded with spaces)
    const paddedName = filename.substring(0, 10).padStart(10, " ");
    for (let i = 0; i < 10; i++) {
      headerData.push(paddedName.charCodeAt(i));
    }

    // Data length (2 bytes, little-endian)
    headerData.push(dataLength & 0xff);
    headerData.push((dataLength >> 8) & 0xff);

    // Start address (2 bytes, little-endian)
    headerData.push(autoStart & 0xff);
    headerData.push((autoStart >> 8) & 0xff);

    // Unused/reserved (2 bytes) - should match data length for CODE blocks
    headerData.push(dataLength & 0xff);
    headerData.push((dataLength >> 8) & 0xff);

    this.addBlock(headerData);
  }

  // Add a data block (type 0xFF)
  addDataBlock(data: number[]) {
    const blockData = [0xff, ...data]; // 0xFF flag for data blocks
    this.addBlock(blockData);
  }

  // Add a block with length header and checksum
  private addBlock(blockData: number[]) {
    // TAP block length must include the checksum byte
    const length = blockData.length + 1; // flag + data + checksum

    // Add 2-byte length (little-endian)
    this.data.push(length & 0xff);
    this.data.push((length >> 8) & 0xff);

    // Add block data (flag + payload)
    this.data.push(...blockData);

    // Calculate and add XOR checksum (over flag + payload only)
    let checksum = 0;
    for (const byte of blockData) {
      checksum ^= byte;
    }
    this.data.push(checksum);
  }

  // Generate the final TAP file as Uint8Array
  generate(): number[] {
    return this.data;
  }

  // Create a downloadable blob
  toBlob(): Blob {
    return new Blob([new Uint8Array(this.data)], { type: "application/octet-stream" });
  }
}

// Z80 Assembly helpers (for future game engine)
export class Z80Assembler {
  private code: number[] = [];

  // LD A, n
  ldA(value: number) {
    this.code.push(0x3e, value & 0xff);
    return this;
  }

  // LD HL, nn
  ldHL(value: number) {
    this.code.push(0x21, value & 0xff, (value >> 8) & 0xff);
    return this;
  }

  // CALL nn
  call(address: number) {
    this.code.push(0xcd, address & 0xff, (address >> 8) & 0xff);
    return this;
  }

  // RET
  ret() {
    this.code.push(0xc9);
    return this;
  }

  // Get compiled code
  getCode(): number[] {
    return this.code;
  }
}

// Convert sprite data to Spectrum screen format
export function spriteToSpectrumFormat(
  pixels: number[][],
  width: number,
  height: number
): number[] {
  const result: number[] = [];
  
  // Spectrum uses character cells (8x8 pixels)
  // Each cell has 8 bytes for bitmap + 1 byte for attributes
  
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      // Extract 8x8 cell
      for (let cy = 0; cy < 8 && y + cy < height; cy++) {
        let byte = 0;
        for (let cx = 0; cx < 8 && x + cx < width; cx++) {
          const pixel = pixels[y + cy]?.[x + cx] ?? 0;
          if (pixel !== 0) {
            byte |= 1 << (7 - cx);
          }
        }
        result.push(byte);
      }
      
      // Add attribute byte (simplified - using first non-zero color)
      let attr = 0x47; // White ink on black paper
      for (let cy = 0; cy < 8 && y + cy < height; cy++) {
        for (let cx = 0; cx < 8 && x + cx < width; cx++) {
          const pixel = pixels[y + cy]?.[x + cx] ?? 0;
          if (pixel !== 0) {
            attr = (pixel & 0x07) | 0x40; // Ink color + bright
            break;
          }
        }
      }
      result.push(attr);
    }
  }
  
  return result;
}
