// TAP file format utilities for ZX Spectrum
// TAP files contain blocks with: 2-byte length, flag byte, data, checksum

export class TAPGenerator {
  private data: number[] = [];

  // Add a BASIC program header and loader
  addBasicLoader(codeLength: number, codeStart: number = 32768) {
    // Create tokenized BASIC program
    const basicProgram: number[] = [];
    
    // Line 10: CLEAR 32767
    basicProgram.push(0x00, 0x0a); // Line number 10 (big-endian)
    const line10Start = basicProgram.length;
    basicProgram.push(0x00, 0x00); // Length placeholder
    basicProgram.push(0xfd); // CLEAR token
    basicProgram.push(0x20); // Space
    // "32767" as ASCII
    basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x37);
    // Encoded number (0x0E + 5-byte float: 32767 = 0x7FFF)
    basicProgram.push(0x0e, 0x00, 0x00, 0xff, 0x7f, 0x00);
    basicProgram.push(0x0d); // ENTER
    const line10Length = basicProgram.length - line10Start - 2;
    basicProgram[line10Start] = line10Length & 0xff;
    basicProgram[line10Start + 1] = (line10Length >> 8) & 0xff;
    
    // Line 20: LOAD "" CODE
    basicProgram.push(0x00, 0x14); // Line number 20
    const line20Start = basicProgram.length;
    basicProgram.push(0x00, 0x00); // Length placeholder
    basicProgram.push(0xef); // LOAD token
    basicProgram.push(0x20); // Space
    basicProgram.push(0x22, 0x22); // Empty string ""
    basicProgram.push(0x20); // Space
    basicProgram.push(0xaf); // CODE token
    basicProgram.push(0x0d); // ENTER
    const line20Length = basicProgram.length - line20Start - 2;
    basicProgram[line20Start] = line20Length & 0xff;
    basicProgram[line20Start + 1] = (line20Length >> 8) & 0xff;
    
    // Line 30: RANDOMIZE USR 32768
    basicProgram.push(0x00, 0x1e); // Line number 30
    const line30Start = basicProgram.length;
    basicProgram.push(0x00, 0x00); // Length placeholder
    basicProgram.push(0xf9); // RANDOMIZE token
    basicProgram.push(0x20); // Space
    basicProgram.push(0xc0); // USR token
    basicProgram.push(0x20); // Space
    // "32768" as ASCII
    basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x38);
    // Encoded number (0x0E + 5-byte float: 32768 = 0x8000)
    basicProgram.push(0x0e, 0x00, 0x00, 0x00, 0x80, 0x00);
    basicProgram.push(0x0d); // ENTER
    const line30Length = basicProgram.length - line30Start - 2;
    basicProgram[line30Start] = line30Length & 0xff;
    basicProgram[line30Start + 1] = (line30Length >> 8) & 0xff;
    
    // BASIC program header
    const headerData: number[] = [
      0x00, // Header block flag
      0x00, // BASIC program type
    ];
    
    // Filename (10 bytes, padded with spaces)
    const filename = "Loader    ";
    for (let i = 0; i < 10; i++) {
      headerData.push(filename.charCodeAt(i));
    }
    
    // Program length
    headerData.push(basicProgram.length & 0xff);
    headerData.push((basicProgram.length >> 8) & 0xff);
    
    // Autostart line (line 10)
    headerData.push(0x0a, 0x00);
    
    // Program length again
    headerData.push(basicProgram.length & 0xff);
    headerData.push((basicProgram.length >> 8) & 0xff);
    
    // Debug logging for comparison
    console.log('[BASIC 3-LINE DEBUG] Total program bytes:', basicProgram.length);
    console.log('[BASIC 3-LINE DEBUG] Full hex dump:', 
      basicProgram.map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    
    console.log('[BASIC 3-LINE DEBUG] Line 10 (CLEAR 32767) - bytes 0-17:', 
      basicProgram.slice(0, 18).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC 3-LINE DEBUG] Line 10 length field:', 
      basicProgram[2] + (basicProgram[3] << 8), 'expected: 14'
    );
    
    console.log('[BASIC 3-LINE DEBUG] Line 20 (LOAD CODE) - bytes 18-29:', 
      basicProgram.slice(18, 30).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC 3-LINE DEBUG] Line 20 length field:', 
      basicProgram[20] + (basicProgram[21] << 8), 'expected: 8'
    );
    
    console.log('[BASIC 3-LINE DEBUG] Line 30 (RANDOMIZE USR) - bytes 30-48:', 
      basicProgram.slice(30, 49).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC 3-LINE DEBUG] Line 30 length field:', 
      basicProgram[32] + (basicProgram[33] << 8), 'expected: 17'
    );
    
    console.log('[BASIC 3-LINE DEBUG] Header bytes:', 
      headerData.map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC 3-LINE DEBUG] Header program length fields:', 
      headerData[12] + (headerData[13] << 8), 'should match:', basicProgram.length
    );
    
    this.addBlock(headerData);
    
    // Add BASIC program data block
    const basicData = [0xff, ...basicProgram]; // 0xFF flag for data blocks
    this.addBlock(basicData);
  }

  // Add a BASIC program header and loader with SCREEN$ support
  addBasicLoaderWithScreen(codeLength: number, codeStart: number = 32768) {
    const basicProgram: number[] = [];
    
    // Line 10: CLEAR 32767
    basicProgram.push(0x00, 0x0a);
    const line10Start = basicProgram.length;
    basicProgram.push(0x00, 0x00);
    basicProgram.push(0xfd, 0x20);
    basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x37);
    basicProgram.push(0x0e, 0x00, 0x00, 0xff, 0x7f, 0x00);
    basicProgram.push(0x0d);
    const line10Length = basicProgram.length - line10Start - 2;
    basicProgram[line10Start] = line10Length & 0xff;
    basicProgram[line10Start + 1] = (line10Length >> 8) & 0xff;
    
    // Line 20: LOAD "" SCREEN$
    basicProgram.push(0x00, 0x14);
    const line20Start = basicProgram.length;
    basicProgram.push(0x00, 0x00);
    basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaa, 0x0d);
    const line20Length = basicProgram.length - line20Start - 2;
    basicProgram[line20Start] = line20Length & 0xff;
    basicProgram[line20Start + 1] = (line20Length >> 8) & 0xff;
    
    // Line 30: LOAD "" CODE
    basicProgram.push(0x00, 0x1e);
    const line30Start = basicProgram.length;
    basicProgram.push(0x00, 0x00);
    basicProgram.push(0xef, 0x20, 0x22, 0x22, 0x20, 0xaf, 0x0d);
    const line30Length = basicProgram.length - line30Start - 2;
    basicProgram[line30Start] = line30Length & 0xff;
    basicProgram[line30Start + 1] = (line30Length >> 8) & 0xff;
    
    // Line 40: RANDOMIZE USR 32768
    basicProgram.push(0x00, 0x28);
    const line40Start = basicProgram.length;
    basicProgram.push(0x00, 0x00);
    basicProgram.push(0xf9, 0x20, 0xc0, 0x20);
    basicProgram.push(0x33, 0x32, 0x37, 0x36, 0x38);
    basicProgram.push(0x0e, 0x00, 0x00, 0x00, 0x80, 0x00);
    basicProgram.push(0x0d);
    const line40Length = basicProgram.length - line40Start - 2;
    basicProgram[line40Start] = line40Length & 0xff;
    basicProgram[line40Start + 1] = (line40Length >> 8) & 0xff;
    
    // Build header
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
    
    // Debug logging for byte-level verification
    console.log('[BASIC WITH SCREEN DEBUG] Total program bytes:', basicProgram.length);
    console.log('[BASIC WITH SCREEN DEBUG] Full hex dump:', 
      basicProgram.map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    
    // Per-line breakdown with calculated lengths
    console.log('[BASIC WITH SCREEN DEBUG] Line 10 (CLEAR 32767) - bytes 0-17:', 
      basicProgram.slice(0, 18).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC WITH SCREEN DEBUG] Line 10 length field:', 
      basicProgram[2] + (basicProgram[3] << 8), 'expected: 14'
    );
    
    console.log('[BASIC WITH SCREEN DEBUG] Line 20 (LOAD SCREEN$) - bytes 18-28:', 
      basicProgram.slice(18, 29).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC WITH SCREEN DEBUG] Line 20 length field:', 
      basicProgram[20] + (basicProgram[21] << 8), 'expected: 7'
    );
    
    console.log('[BASIC WITH SCREEN DEBUG] Line 30 (LOAD CODE) - bytes 29-39:', 
      basicProgram.slice(29, 40).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC WITH SCREEN DEBUG] Line 30 length field:', 
      basicProgram[31] + (basicProgram[32] << 8), 'expected: 7'
    );
    
    console.log('[BASIC WITH SCREEN DEBUG] Line 40 (RANDOMIZE USR) - bytes 40-59:', 
      basicProgram.slice(40, 60).map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC WITH SCREEN DEBUG] Line 40 length field:', 
      basicProgram[42] + (basicProgram[43] << 8), 'expected: 16'
    );
    
    console.log('[BASIC WITH SCREEN DEBUG] Header bytes:', 
      headerData.map(b => b.toString(16).padStart(2,'0')).join(' ')
    );
    console.log('[BASIC WITH SCREEN DEBUG] Header program length fields:', 
      headerData[12] + (headerData[13] << 8), 'should match:', basicProgram.length
    );
    
    this.addBlock(headerData);
    this.addBlock([0xff, ...basicProgram]);
  }

  // Add a CODE header block (type 0x00)
  addHeader(filename: string, dataLength: number, autoStart: number = 32768) {
    const headerData: number[] = [
      0x00, // Header block flag
      0x03, // Program file type (CODE)
    ];

    // Filename (10 bytes, padded with spaces) - LEFT-ALIGNED
    const paddedName = filename.substring(0, 10).padEnd(10, " ");
    for (let i = 0; i < 10; i++) {
      headerData.push(paddedName.charCodeAt(i));
    }

    // Data length (2 bytes, little-endian)
    headerData.push(dataLength & 0xff);
    headerData.push((dataLength >> 8) & 0xff);

    // Start address (2 bytes, little-endian)
    headerData.push(autoStart & 0xff);
    headerData.push((autoStart >> 8) & 0xff);

    // Parameter 2 for CODE files must be 32768 (0x8000) per Spectrum ROM spec
    // This is how the ROM distinguishes CODE (incl. SCREEN$) from other types
    headerData.push(0x00);
    headerData.push(0x80);

    this.addBlock(headerData);
  }

  // Add a data block (type 0xFF)
  addDataBlock(data: number[]) {
    const blockData = [0xff, ...data]; // 0xFF flag for data blocks
    this.addBlock(blockData);
  }

  // Add a block with length header and checksum (made public for direct access)
  addBlock(blockData: number[]) {
    // TAP block length INCLUDES the checksum byte per Spectrum spec
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
