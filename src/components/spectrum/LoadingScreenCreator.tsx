import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SPECTRUM_COLORS, type SpectrumColor, type Screen } from "@/types/spectrum";
import { processImageForSpectrum, SPECTRUM_WIDTH, SPECTRUM_HEIGHT, ATTR_BLOCK } from "./spectrumImageTools";
import { ColorPalette } from "./ColorPalette";
import { toast } from "sonner";
import { Upload, Check, AlertTriangle } from "lucide-react";

interface LoadingScreenCreatorProps {
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
  onBlockEditPanelChange?: (panel: React.ReactNode) => void;
}

type BlockError = {
  bx: number;
  by: number;
  colors: string[];
};

type PixelEdit = {
  x: number;
  y: number;
  color: string;
  role: "ink" | "paper";
};

export const LoadingScreenCreator = ({ screen, onScreenChange, onBlockEditPanelChange }: LoadingScreenCreatorProps) => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [blockErrors, setBlockErrors] = useState<BlockError[]>([]);
  const [selectedBlockError, setSelectedBlockError] = useState<BlockError | null>(null);
  const [originalBlockPixels, setOriginalBlockPixels] = useState<SpectrumColor[][] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [flashingBlocks, setFlashingBlocks] = useState(new Set<string>());
  const [activeTab, setActiveTab] = useState<"upload" | "final" | "stripped">("final");
  const [inkPaperView, setInkPaperView] = useState<"both" | "ink" | "paper">("both");
  const [hoveredBlock, setHoveredBlock] = useState<{ bx: number; by: number } | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<{
    localX: number;
    localY: number;
    color: SpectrumColor;
  } | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[7]);
  const [extraColorMapping, setExtraColorMapping] = useState<Record<string, "ink" | "paper">>({});
  
  // Stripped preview options - initialize from screen or use defaults
  const [paperStrategy, setPaperStrategy] = useState<"lighter" | "darker" | "bigger" | "smaller">(
    screen.conversionOptions?.paperStrategy || "lighter"
  );
  const [singleColorAs, setSingleColorAs] = useState<"paper" | "ink">(
    screen.conversionOptions?.singleColorAs || "paper"
  );
  const [preserveNeighbors, setPreserveNeighbors] = useState<"no" | "left" | "up" | "match">(
    screen.conversionOptions?.preserveNeighbors || "no"
  );
  const [strippedPixels, setStrippedPixels] = useState<SpectrumColor[][] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomedCanvasRef = useRef<HTMLCanvasElement>(null);
  const strippedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screen.pixels) {
      drawMainCanvas();
    }
  }, [screen.pixels, flashingBlocks, inkPaperView, selectedBlockError, hoveredBlock]);

  useEffect(() => {
    if (selectedBlockError) {
      // Render edit panel in sidebar first
      if (onBlockEditPanelChange) {
        onBlockEditPanelChange(renderBlockEditPanel());
      }
      
      // Draw the zoomed block after a brief delay to ensure canvas is mounted
      requestAnimationFrame(() => {
        drawZoomedBlock();
      });
    } else {
      // Clear edit panel when no block selected
      if (onBlockEditPanelChange) {
        onBlockEditPanelChange(null);
      }
    }
  }, [selectedBlockError, screen.pixels, selectedPixel, selectedColor, extraColorMapping]);

  useEffect(() => {
    if (activeTab === "stripped" && screen.pixels) {
      // Save conversion options to screen
      onScreenChange({
        ...screen,
        conversionOptions: {
          paperStrategy,
          singleColorAs,
          preserveNeighbors,
        },
      });

      // Use requestAnimationFrame to ensure canvas is mounted
      requestAnimationFrame(() => {
        generateStrippedPreview();
      });
    }
  }, [activeTab, screen.pixels, paperStrategy, singleColorAs, preserveNeighbors]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFlashingBlocks(prev => new Set(prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      setAnalyzing(true);
      toast.info("Processing image for ZX Spectrum format...");

      try {
        const processed = await processImageForSpectrum(img);
        setImageData(processed);

        // Convert ImageData to pixels array
        const pixels: SpectrumColor[][] = Array(SPECTRUM_HEIGHT)
          .fill(null)
          .map(() => Array(SPECTRUM_WIDTH).fill(SPECTRUM_COLORS[0]));

        for (let y = 0; y < SPECTRUM_HEIGHT; y++) {
          for (let x = 0; x < SPECTRUM_WIDTH; x++) {
            const i = (y * SPECTRUM_WIDTH + x) * 4;
            const r = processed.data[i];
            const g = processed.data[i + 1];
            const b = processed.data[i + 2];

            const color = getNearestSpectrumColor(r, g, b);

            pixels[y][x] = color;
          }
        }

        onScreenChange({ ...screen, pixels });

        // Analyze for errors
        analyzeBlocks(pixels);
        setActiveTab("final");
        toast.success("Image loaded! Analyzing blocks...");
      } catch (error) {
        toast.error("Failed to process image");
        console.error(error);
      } finally {
        setAnalyzing(false);
      }
    };

    img.src = URL.createObjectURL(file);
  };

  const analyzeBlocks = (pixels: SpectrumColor[][]) => {
    const errors: BlockError[] = [];

    for (let by = 0; by < SPECTRUM_HEIGHT; by += ATTR_BLOCK) {
      for (let bx = 0; bx < SPECTRUM_WIDTH; bx += ATTR_BLOCK) {
        const colors = new Set<string>();

        for (let y = 0; y < ATTR_BLOCK; y++) {
          for (let x = 0; x < ATTR_BLOCK; x++) {
            const py = by + y;
            const px = bx + x;
            if (py < SPECTRUM_HEIGHT && px < SPECTRUM_WIDTH) {
              colors.add(pixels[py][px].value);
            }
          }
        }

        if (colors.size > 2) {
          errors.push({
            bx,
            by,
            colors: Array.from(colors)
          });
        }
      }
    }

    setBlockErrors(errors);

    if (errors.length === 0) {
      toast.success("All blocks compliant! Ready for export.");
      setActiveTab("stripped");
    } else {
      toast.warning(`${errors.length} blocks need fixing (>2 colors)`);
      // Flash error blocks
      const errorKeys = new Set(errors.map(e => `${e.bx},${e.by}`));
      setFlashingBlocks(errorKeys);
    }
  };

  const drawMainCanvas = () => {
    if (!screen.pixels) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 2;
    canvas.width = SPECTRUM_WIDTH * scale;
    canvas.height = SPECTRUM_HEIGHT * scale;

    ctx.imageSmoothingEnabled = false;

    // Draw pixels
    screen.pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (!color) return;

        // Apply ink/paper filter
        if (inkPaperView !== "both") {
          // Determine if pixel is ink or paper based on neighboring blocks
          const bx = Math.floor(x / ATTR_BLOCK) * ATTR_BLOCK;
          const by = Math.floor(y / ATTR_BLOCK) * ATTR_BLOCK;
          const blockColors = getBlockColors(bx, by);
          
          if (blockColors.length === 2) {
            const isInk = color.value === blockColors[0];
            if ((inkPaperView === "ink" && !isInk) || (inkPaperView === "paper" && isInk)) {
              return; // Skip this pixel
            }
          }
        }

        ctx.fillStyle = color.value;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });

    // Draw error blocks with flashing red border
    const flashOn = Math.floor(Date.now() / 500) % 2 === 0;
    blockErrors.forEach(error => {
      const key = `${error.bx},${error.by}`;
      if (flashingBlocks.has(key)) {
        ctx.strokeStyle = flashOn ? "#FF0000" : "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          error.bx * scale,
          error.by * scale,
          ATTR_BLOCK * scale,
          ATTR_BLOCK * scale
        );
      }
    });

    // Highlight hovered block
    if (hoveredBlock) {
      ctx.strokeStyle = "#FFFF00";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoveredBlock.bx * scale,
        hoveredBlock.by * scale,
        ATTR_BLOCK * scale,
        ATTR_BLOCK * scale
      );
    }

    // Highlight selected block
    if (selectedBlockError) {
      ctx.strokeStyle = "#FFFF00";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedBlockError.bx * scale,
        selectedBlockError.by * scale,
        ATTR_BLOCK * scale,
        ATTR_BLOCK * scale
      );
    }

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= SPECTRUM_WIDTH; x += ATTR_BLOCK) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, SPECTRUM_HEIGHT * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= SPECTRUM_HEIGHT; y += ATTR_BLOCK) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(SPECTRUM_WIDTH * scale, y * scale);
      ctx.stroke();
    }
  };

  const drawZoomedBlock = () => {
    if (!selectedBlockError || !screen.pixels) return;

    const canvas = zoomedCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pixelSize = 32; // 256px / 8px = 32
    canvas.width = ATTR_BLOCK * pixelSize;
    canvas.height = ATTR_BLOCK * pixelSize;

    ctx.imageSmoothingEnabled = false;

    const { bx, by } = selectedBlockError;
    const blockColors = getBlockColors(bx, by);

    // Draw pixels
    for (let y = 0; y < ATTR_BLOCK; y++) {
      for (let x = 0; x < ATTR_BLOCK; x++) {
        const px = bx + x;
        const py = by + y;
        const color = screen.pixels[py]?.[px];

        if (color) {
          ctx.fillStyle = color.value;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

          const isErrorPixel = blockColors.length > 2 && blockColors.indexOf(color.value) >= 2;
          const isSelectedPixel = selectedPixel && selectedPixel.localX === x && selectedPixel.localY === y;

          // Highlight error pixels with red fill (70% opacity)
          if (isErrorPixel && !isSelectedPixel) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
          }

          // Selected pixel gets red border (70% opacity)
          if (isSelectedPixel) {
            ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
            ctx.lineWidth = 3;
            ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    }

    // Draw pixel grid
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= ATTR_BLOCK; x++) {
      ctx.beginPath();
      ctx.moveTo(x * pixelSize, 0);
      ctx.lineTo(x * pixelSize, ATTR_BLOCK * pixelSize);
      ctx.stroke();
    }
    for (let y = 0; y <= ATTR_BLOCK; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * pixelSize);
      ctx.lineTo(ATTR_BLOCK * pixelSize, y * pixelSize);
      ctx.stroke();
    }
  };

  const getBlockColors = (bx: number, by: number): string[] => {
    if (!screen.pixels) return [];

    const colors = new Set<string>();
    for (let y = 0; y < ATTR_BLOCK; y++) {
      for (let x = 0; x < ATTR_BLOCK; x++) {
        const px = bx + x;
        const py = by + y;
        if (py < SPECTRUM_HEIGHT && px < SPECTRUM_WIDTH) {
          colors.add(screen.pixels[py][px].value);
        }
      }
    }
    return Array.from(colors);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = 2;
    const bx = Math.floor((e.clientX - rect.left) / scale / ATTR_BLOCK) * ATTR_BLOCK;
    const by = Math.floor((e.clientY - rect.top) / scale / ATTR_BLOCK) * ATTR_BLOCK;

    if (bx < 0 || by < 0 || bx >= SPECTRUM_WIDTH || by >= SPECTRUM_HEIGHT) {
      setHoveredBlock(null);
      return;
    }

    if (!hoveredBlock || hoveredBlock.bx !== bx || hoveredBlock.by !== by) {
      setHoveredBlock({ bx, by });
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredBlock(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = 2;
    const bx = Math.floor((e.clientX - rect.left) / scale / ATTR_BLOCK) * ATTR_BLOCK;
    const by = Math.floor((e.clientY - rect.top) / scale / ATTR_BLOCK) * ATTR_BLOCK;

    if (bx < 0 || by < 0 || bx >= SPECTRUM_WIDTH || by >= SPECTRUM_HEIGHT) {
      return;
    }

    // Store original block pixels for cancel functionality
    if (screen.pixels) {
      const blockPixels: SpectrumColor[][] = [];
      for (let y = 0; y < ATTR_BLOCK; y++) {
        blockPixels[y] = [];
        for (let x = 0; x < ATTR_BLOCK; x++) {
          const px = bx + x;
          const py = by + y;
          blockPixels[y][x] = screen.pixels[py][px];
        }
      }
      setOriginalBlockPixels(blockPixels);
    }

    const error = blockErrors.find(e => e.bx === bx && e.by === by);

    if (error) {
      setSelectedBlockError(error);
    } else {
      const colors = getBlockColors(bx, by);
      setSelectedBlockError({ bx, by, colors });
    }

    setSelectedPixel(null);
    setExtraColorMapping({});
  };

  const handlePixelClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedBlockError || !screen.pixels) return;

    const canvas = zoomedCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelSize = 32;
    const localX = Math.floor((e.clientX - rect.left) / pixelSize);
    const localY = Math.floor((e.clientY - rect.top) / pixelSize);

    if (
      localX < 0 ||
      localY < 0 ||
      localX >= ATTR_BLOCK ||
      localY >= ATTR_BLOCK
    ) {
      return;
    }

    const px = selectedBlockError.bx + localX;
    const py = selectedBlockError.by + localY;

    const currentColor = screen.pixels[py]?.[px];
    if (!currentColor) return;

    setSelectedPixel({ localX, localY, color: currentColor });
  };

  const applyPixelColor = (targetColor: SpectrumColor) => {
    if (!screen.pixels || !selectedBlockError || !selectedPixel) return;

    const globalX = selectedBlockError.bx + selectedPixel.localX;
    const globalY = selectedBlockError.by + selectedPixel.localY;

    const newPixels = screen.pixels.map((row, y) =>
      y === globalY ? row.map((col, x) => (x === globalX ? targetColor : col)) : row
    );

    onScreenChange({ ...screen, pixels: newPixels });
    setSelectedPixel({ ...selectedPixel, color: targetColor });

    // Re-analyze the current block
    const blockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    const updatedError = { ...selectedBlockError, colors: blockColors };
    setSelectedBlockError(updatedError);
  };

  const handleUpdateBlock = () => {
    if (!screen.pixels || !selectedBlockError) return;

    // Re-analyze all blocks
    analyzeBlocks(screen.pixels);
    
    const blockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    if (blockColors.length <= 2) {
      toast.success("Block updated! Now compliant with ZX Spectrum rules.");
      setSelectedBlockError(null);
      setSelectedPixel(null);
      setOriginalBlockPixels(null);
      setExtraColorMapping({});
      
      // Clear sidebar panel
      if (onBlockEditPanelChange) {
        onBlockEditPanelChange(null);
      }
    } else {
      toast.warning("Block still has more than 2 colors. Keep editing.");
    }
  };

  const handleCancelBlock = () => {
    if (!originalBlockPixels || !selectedBlockError || !screen.pixels) return;

    // Restore original pixels
    const newPixels = screen.pixels.map((row, y) => [...row]);
    for (let y = 0; y < ATTR_BLOCK; y++) {
      for (let x = 0; x < ATTR_BLOCK; x++) {
        const px = selectedBlockError.bx + x;
        const py = selectedBlockError.by + y;
        newPixels[py][px] = originalBlockPixels[y][x];
      }
    }

    onScreenChange({ ...screen, pixels: newPixels });
    
    // Re-analyze blocks to update error list
    analyzeBlocks(newPixels);
    
    setSelectedBlockError(null);
    setSelectedPixel(null);
    setOriginalBlockPixels(null);
    setExtraColorMapping({});
    
    // Clear sidebar panel
    if (onBlockEditPanelChange) {
      onBlockEditPanelChange(null);
    }
    
    toast.info("Changes cancelled. Block restored.");
  };

  const handleExportSCR = () => {
    if (!screen.pixels || blockErrors.length > 0) {
      toast.error("Cannot export: blocks still have errors");
      return;
    }

    // Create SCR file data (6912 bytes: 6144 bitmap + 768 attributes)
    const scrData = new Uint8Array(6912);
    
    // Convert pixels to ZX Spectrum bitmap and attributes using correct scanline formula
    for (let by = 0; by < SPECTRUM_HEIGHT; by += ATTR_BLOCK) {
      for (let bx = 0; bx < SPECTRUM_WIDTH; bx += ATTR_BLOCK) {
        const blockColors = getBlockColors(bx, by);
        
        // Find the spectrum colors for ink and paper
        const inkSpectrumColor = SPECTRUM_COLORS.find(c => c.value === blockColors[0]) || SPECTRUM_COLORS[0];
        const paperSpectrumColor = SPECTRUM_COLORS.find(c => c.value === (blockColors[1] || blockColors[0])) || SPECTRUM_COLORS[7];
        
        // Extract ink/paper color indices (0-7) and bright flag
        const inkValue = inkSpectrumColor.ink; // 0-7
        const paperValue = paperSpectrumColor.ink; // 0-7
        const bright = inkSpectrumColor.bright || paperSpectrumColor.bright ? 1 : 0;
        const flash = 0; // No flash support for now
        
        // Set attribute byte: FLASH(bit7) | BRIGHT(bit6) | PAPER(bits5-3) | INK(bits2-0)
        const attrIndex = 6144 + (by / 8) * 32 + (bx / 8);
        scrData[attrIndex] = (flash << 7) | (bright << 6) | (paperValue << 3) | inkValue;
        
        // Set bitmap bytes using correct ZX Spectrum scanline formula
        for (let y = 0; y < ATTR_BLOCK; y++) {
          const py = by + y;
          // ZX Spectrum scanline address formula: (y & 0xC0) << 5 | (y & 0x07) << 8 | (y & 0x38) << 2 | (x / 8)
          const scanline = ((py & 0xC0) << 5) | ((py & 0x07) << 8) | ((py & 0x38) << 2) | (bx / 8);
          let byte = 0;
          
          for (let x = 0; x < ATTR_BLOCK; x++) {
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

    // Download SCR file
    const blob = new Blob([scrData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${screen.name || "loading"}.scr`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("SCR file exported successfully!");
  };

  const handleSCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size !== 6912) {
      toast.error("Invalid SCR file: must be 6912 bytes");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const scrData = new Uint8Array(arrayBuffer);
      
      // Convert SCR to pixels
      const pixels: SpectrumColor[][] = Array(SPECTRUM_HEIGHT)
        .fill(null)
        .map(() => Array(SPECTRUM_WIDTH).fill(SPECTRUM_COLORS[0]));

      for (let by = 0; by < SPECTRUM_HEIGHT; by += ATTR_BLOCK) {
        for (let bx = 0; bx < SPECTRUM_WIDTH; bx += ATTR_BLOCK) {
          const attrIndex = 6144 + (by / 8) * 32 + (bx / 8);
          const attr = scrData[attrIndex];
          
          // Decode attribute byte: FLASH(bit7) | BRIGHT(bit6) | PAPER(bits5-3) | INK(bits2-0)
          const inkValue = attr & 0x07; // bits 0-2
          const paperValue = (attr >> 3) & 0x07; // bits 3-5
          const bright = (attr >> 6) & 0x01; // bit 6
          // const flash = (attr >> 7) & 0x01; // bit 7 (not used)
          
          // Find the correct spectrum color based on ink value and bright flag
          const inkColor = SPECTRUM_COLORS.find(c => c.ink === inkValue && c.bright === Boolean(bright)) || SPECTRUM_COLORS[inkValue];
          const paperColor = SPECTRUM_COLORS.find(c => c.ink === paperValue && c.bright === Boolean(bright)) || SPECTRUM_COLORS[paperValue];
          
          for (let y = 0; y < ATTR_BLOCK; y++) {
            const py = by + y;
            // Use correct ZX Spectrum scanline formula for reading
            const scanline = ((py & 0xC0) << 5) | ((py & 0x07) << 8) | ((py & 0x38) << 2) | (bx / 8);
            const byte = scrData[scanline];
            
            for (let x = 0; x < ATTR_BLOCK; x++) {
              const px = bx + x;
              const bit = (byte >> (7 - x)) & 1;
              pixels[py][px] = bit ? inkColor : paperColor;
            }
          }
        }
      }

      onScreenChange({ ...screen, pixels });
      analyzeBlocks(pixels);
      setActiveTab("final");
      toast.success("SCR file loaded successfully!");
    } catch (error) {
      toast.error("Failed to load SCR file");
      console.error(error);
    }
  };

  const generateStrippedPreview = () => {
    if (!screen.pixels) return;

    const stripped: SpectrumColor[][] = Array(SPECTRUM_HEIGHT)
      .fill(null)
      .map(() => Array(SPECTRUM_WIDTH).fill(SPECTRUM_COLORS[0]));

    const black = SPECTRUM_COLORS[0];
    const white = SPECTRUM_COLORS[7];

    // Track paper color choices per block for neighbor preservation
    const blockPaperColors = new Map<string, string>();

    for (let by = 0; by < SPECTRUM_HEIGHT; by += ATTR_BLOCK) {
      for (let bx = 0; bx < SPECTRUM_WIDTH; bx += ATTR_BLOCK) {
        const blockColors = getBlockColors(bx, by);
        
        if (blockColors.length === 1) {
          // Single color block
          const targetColor = singleColorAs === "paper" ? black : white;
          for (let y = 0; y < ATTR_BLOCK; y++) {
            for (let x = 0; x < ATTR_BLOCK; x++) {
              stripped[by + y][bx + x] = targetColor;
            }
          }
        } else if (blockColors.length === 2) {
          let paperColor: string;
          let inkColor: string;

          // Check if we should preserve neighbor's paper color
          if (preserveNeighbors !== "no") {
            let neighborPaper: string | undefined;

            if (preserveNeighbors === "left" && bx > 0) {
              const leftKey = `${bx - ATTR_BLOCK},${by}`;
              neighborPaper = blockPaperColors.get(leftKey);
            } else if (preserveNeighbors === "up" && by > 0) {
              const upKey = `${bx},${by - ATTR_BLOCK}`;
              neighborPaper = blockPaperColors.get(upKey);
            } else if (preserveNeighbors === "match") {
              // Try left first, then up
              if (bx > 0) {
                const leftKey = `${bx - ATTR_BLOCK},${by}`;
                neighborPaper = blockPaperColors.get(leftKey);
              }
              if (!neighborPaper && by > 0) {
                const upKey = `${bx},${by - ATTR_BLOCK}`;
                neighborPaper = blockPaperColors.get(upKey);
              }
            }

            // If neighbor has a matching color, use it as paper
            if (neighborPaper && blockColors.includes(neighborPaper)) {
              paperColor = neighborPaper;
              inkColor = blockColors[0] === paperColor ? blockColors[1] : blockColors[0];
              blockPaperColors.set(`${bx},${by}`, paperColor);
              
              // Apply to stripped preview
              for (let y = 0; y < ATTR_BLOCK; y++) {
                for (let x = 0; x < ATTR_BLOCK; x++) {
                  const originalColor = screen.pixels[by + y][bx + x].value;
                  stripped[by + y][bx + x] = originalColor === inkColor ? white : black;
                }
              }
              continue;
            }
          }

          // No neighbor match or preserveNeighbors is "no" - use strategy
          if (paperStrategy === "lighter") {
            const brightness = (c: string) => {
              const rgb = hexToRgb(c);
              return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
            };
            paperColor = brightness(blockColors[0]) > brightness(blockColors[1]) ? blockColors[0] : blockColors[1];
            inkColor = paperColor === blockColors[0] ? blockColors[1] : blockColors[0];
          } else if (paperStrategy === "darker") {
            const brightness = (c: string) => {
              const rgb = hexToRgb(c);
              return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
            };
            paperColor = brightness(blockColors[0]) < brightness(blockColors[1]) ? blockColors[0] : blockColors[1];
            inkColor = paperColor === blockColors[0] ? blockColors[1] : blockColors[0];
          } else if (paperStrategy === "bigger") {
            let count0 = 0, count1 = 0;
            for (let y = 0; y < ATTR_BLOCK; y++) {
              for (let x = 0; x < ATTR_BLOCK; x++) {
                const color = screen.pixels[by + y][bx + x].value;
                if (color === blockColors[0]) count0++;
                else if (color === blockColors[1]) count1++;
              }
            }
            paperColor = count0 > count1 ? blockColors[0] : blockColors[1];
            inkColor = paperColor === blockColors[0] ? blockColors[1] : blockColors[0];
          } else {
            let count0 = 0, count1 = 0;
            for (let y = 0; y < ATTR_BLOCK; y++) {
              for (let x = 0; x < ATTR_BLOCK; x++) {
                const color = screen.pixels[by + y][bx + x].value;
                if (color === blockColors[0]) count0++;
                else if (color === blockColors[1]) count1++;
              }
            }
            paperColor = count0 < count1 ? blockColors[0] : blockColors[1];
            inkColor = paperColor === blockColors[0] ? blockColors[1] : blockColors[0];
          }

          // Store this block's paper color for future neighbors
          blockPaperColors.set(`${bx},${by}`, paperColor);

          // Apply to stripped preview
          for (let y = 0; y < ATTR_BLOCK; y++) {
            for (let x = 0; x < ATTR_BLOCK; x++) {
              const originalColor = screen.pixels[by + y][bx + x].value;
              stripped[by + y][bx + x] = originalColor === inkColor ? white : black;
            }
          }
        }
      }
    }

    setStrippedPixels(stripped);
    drawStrippedCanvas(stripped);
  };

  const drawStrippedCanvas = (pixels: SpectrumColor[][]) => {
    const canvas = strippedCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 2;
    canvas.width = SPECTRUM_WIDTH * scale;
    canvas.height = SPECTRUM_HEIGHT * scale;

    ctx.imageSmoothingEnabled = false;

    // Draw pixels
    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color.value;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= SPECTRUM_WIDTH; x += ATTR_BLOCK) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, SPECTRUM_HEIGHT * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= SPECTRUM_HEIGHT; y += ATTR_BLOCK) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(SPECTRUM_WIDTH * scale, y * scale);
      ctx.stroke();
    }
  };

  const handleUseAsLoadingScreen = () => {
    if (blockErrors.length > 0) {
      toast.error("Cannot use: blocks still have errors");
      return;
    }

    // Mark this screen as loading type if not already
    if (screen.type !== "loading") {
      onScreenChange({ ...screen, type: "loading" });
    }
    
    toast.success("Screen marked as loading screen! It will appear first in TAP export.");
    setActiveTab("final");
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
  };

  const getNearestSpectrumColor = (r: number, g: number, b: number): SpectrumColor => {
    let closest = SPECTRUM_COLORS[0];
    let minDist = Number.MAX_VALUE;

    for (const color of SPECTRUM_COLORS) {
      const rgb = hexToRgb(color.value);
      const dr = rgb.r - r;
      const dg = rgb.g - g;
      const db = rgb.b - b;
      const dist = dr * dr + dg * dg + db * db;

      if (dist < minDist) {
        minDist = dist;
        closest = color;
      }
    }

    return closest;
  };

  const mapExtraColorToInkOrPaper = (extraColor: string, target: "ink" | "paper") => {
    if (!screen.pixels || !selectedBlockError) return;

    const blockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    const targetColor = target === "ink" ? blockColors[0] : blockColors[1];
    const targetSpecColor = SPECTRUM_COLORS.find(c => c.value === targetColor);
    if (!targetSpecColor) return;

    const newPixels = screen.pixels.map((row, y) => [...row]);

    for (let y = 0; y < ATTR_BLOCK; y++) {
      for (let x = 0; x < ATTR_BLOCK; x++) {
        const px = selectedBlockError.bx + x;
        const py = selectedBlockError.by + y;
        if (newPixels[py][px].value === extraColor) {
          newPixels[py][px] = targetSpecColor;
        }
      }
    }

    onScreenChange({ ...screen, pixels: newPixels });

    // Re-analyze
    const updatedBlockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    setSelectedBlockError({ ...selectedBlockError, colors: updatedBlockColors });
    
    // Check if block is now compliant and show success message
    if (updatedBlockColors.length <= 2) {
      toast.success("✓ This block now follows the ZX Spectrum rules of two colours per block");
    }
  };

  const renderBlockEditPanel = () => {
    if (!selectedBlockError) return null;

    return (
      <div className="space-y-4">
        {/* Block/Pixel Details Panel */}
        <Card className="p-4">
          {!selectedPixel ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Block Details</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Block:</strong> [{selectedBlockError.bx / 8}, {selectedBlockError.by / 8}]</p>
                <p>
                  <strong>Colours Used:</strong> {selectedBlockError.colors.length}
                  {selectedBlockError.colors.length > 2 && (
                    <span className="text-red-500 ml-1">(Error)</span>
                  )}
                </p>
              </div>
              {selectedBlockError.colors.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-semibold">Detected Colours:</p>
                  {selectedBlockError.colors.map((colorValue, idx) => {
                    const specColor = SPECTRUM_COLORS.find(c => c.value === colorValue);
                    const role = idx === 0 ? "Ink" : idx === 1 ? "Paper" : "Extra";
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: colorValue }}
                          />
                          <span className="text-xs flex-1">
                            {specColor?.name || "Unknown"} ({role})
                          </span>
                        </div>
                        {idx >= 2 && (
                          <RadioGroup
                            value={extraColorMapping[colorValue]}
                            onValueChange={(v) => {
                              setExtraColorMapping({
                                ...extraColorMapping,
                                [colorValue]: v as "ink" | "paper"
                              });
                              mapExtraColorToInkOrPaper(colorValue, v as "ink" | "paper");
                            }}
                            className="ml-6 space-y-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="ink" id={`${colorValue}-ink`} />
                              <Label htmlFor={`${colorValue}-ink`} className="text-xs">
                                Map to Ink
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="paper" id={`${colorValue}-paper`} />
                              <Label htmlFor={`${colorValue}-paper`} className="text-xs">
                                Map to Paper
                              </Label>
                            </div>
                          </RadioGroup>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Pixel Details</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Block:</strong> [{selectedBlockError.bx / 8}, {selectedBlockError.by / 8}]</p>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold">Detected Colour:</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: selectedPixel.color.value }}
                  />
                  <span className="text-xs">{selectedPixel.color.name}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Block Canvas Panel */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">Block (256×256px)</h3>
          <div className="border border-border rounded p-2 bg-black inline-block">
            <canvas
              ref={zoomedCanvasRef}
              onClick={handlePixelClick}
              className="cursor-pointer"
              style={{ imageRendering: "pixelated", maxWidth: "100%" }}
            />
          </div>
          {selectedBlockError.colors.length <= 2 && (
            <p className="text-xs text-green-600 mt-2">
              ✓ This block now follows the ZX Spectrum rules of two colours per block
            </p>
          )}
        </Card>

        {/* Color Palette Panel */}
        {selectedPixel && (
          <Card className="p-4">
            <ColorPalette
              selectedColor={selectedColor}
              onColorSelect={(color) => {
                setSelectedColor(color);
                applyPixelColor(color);
              }}
              className=""
            />
          </Card>
        )}

        {/* Update/Cancel Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleUpdateBlock} className="flex-1">
            Update
          </Button>
          <Button onClick={handleCancelBlock} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-bold mb-4">Loading Screen Creator</h2>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="final" disabled={!screen.pixels}>
                Final Artwork
              </TabsTrigger>
              <TabsTrigger value="stripped" disabled={blockErrors.length > 0}>
                Stripped Preview
              </TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpg,image/jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={scrInputRef}
                type="file"
                accept=".scr"
                onChange={handleSCRUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={analyzing}
                size="sm"
              >
                {analyzing ? "Processing..." : "Upload PNG"}
              </Button>
              <Button 
                onClick={() => scrInputRef.current?.click()}
                variant="outline"
                size="sm"
              >
                Upload SCR
              </Button>
            </div>
          </div>


          <TabsContent value="final" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {blockErrors.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-5 h-5" />
                    <span className="font-semibold">All blocks compliant!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">{blockErrors.length} blocks need fixing</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label>View:</Label>
                <Select value={inkPaperView} onValueChange={(v) => setInkPaperView(v as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="ink">Ink Only</SelectItem>
                    <SelectItem value="paper">Paper Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="mb-2 block">Main Canvas (512×384px)</Label>
                <div className="border border-border rounded p-2 bg-black inline-block">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    className="cursor-pointer"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>

                {blockErrors.length > 0 && !selectedBlockError && (
                  <div className="mt-4 p-4 border border-border rounded">
                    <h3 className="font-semibold mb-2">Error Blocks</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {blockErrors.map((error, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedBlockError(error);
                            setSelectedPixel(null);
                          }}
                          className="w-full text-left text-sm p-2 rounded hover:bg-muted"
                        >
                          Block [{error.bx / 8}, {error.by / 8}] - {error.colors.length} colors
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stripped" className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-semibold">Conversion Options</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Color to use as paper</Label>
                  <Select value={paperStrategy} onValueChange={(v) => setPaperStrategy(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lighter">Lighter</SelectItem>
                      <SelectItem value="darker">Darker</SelectItem>
                      <SelectItem value="bigger">Bigger area</SelectItem>
                      <SelectItem value="smaller">Smaller area</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Single color blocks use</Label>
                  <Select value={singleColorAs} onValueChange={(v) => setSingleColorAs(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paper">Paper</SelectItem>
                      <SelectItem value="ink">Ink</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Preserve neighbor's colors</Label>
                  <Select value={preserveNeighbors} onValueChange={(v) => setPreserveNeighbors(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="up">Up</SelectItem>
                      <SelectItem value="match">Match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border border-border rounded p-4 bg-black">
                <canvas
                  ref={strippedCanvasRef}
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <Button
            onClick={handleExportSCR}
            disabled={blockErrors.length > 0}
            variant="default"
          >
            Export as SCR
          </Button>
          <Button
            onClick={handleUseAsLoadingScreen}
            disabled={blockErrors.length > 0}
            variant="default"
          >
            Use as Loading Screen
          </Button>
          <Button variant="outline" onClick={() => setActiveTab("upload")}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
};
