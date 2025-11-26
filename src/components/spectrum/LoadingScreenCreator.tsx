import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPECTRUM_COLORS, type SpectrumColor, type Screen } from "@/types/spectrum";
import { processImageForSpectrum, SPECTRUM_WIDTH, SPECTRUM_HEIGHT, ATTR_BLOCK } from "./spectrumImageTools";
import { toast } from "sonner";
import { Upload, Check, AlertTriangle } from "lucide-react";

interface LoadingScreenCreatorProps {
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
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

export const LoadingScreenCreator = ({ screen, onScreenChange }: LoadingScreenCreatorProps) => {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [blockErrors, setBlockErrors] = useState<BlockError[]>([]);
  const [selectedBlockError, setSelectedBlockError] = useState<BlockError | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [flashingBlocks, setFlashingBlocks] = useState(new Set<string>());
  const [activeTab, setActiveTab] = useState<"upload" | "final" | "stripped">("upload");
  const [inkPaperView, setInkPaperView] = useState<"both" | "ink" | "paper">("both");
  const [hoveredBlock, setHoveredBlock] = useState<{ bx: number; by: number } | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<{
    localX: number;
    localY: number;
    color: SpectrumColor;
  } | null>(null);
  
  // Stripped preview options
  const [paperColor, setPaperColor] = useState<SpectrumColor>(SPECTRUM_COLORS[0]);
  const [singleColorAs, setSingleColorAs] = useState<"paper" | "ink">("paper");
  const [preserveNeighbors, setPreserveNeighbors] = useState<"no" | "left" | "up" | "match">("no");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screen.pixels) {
      drawMainCanvas();
    }
  }, [screen.pixels, flashingBlocks, inkPaperView, selectedBlockError, hoveredBlock]);

  useEffect(() => {
    if (selectedBlockError) {
      drawZoomedBlock();
    }
  }, [selectedBlockError, screen.pixels]);

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
        ctx.lineWidth = 3;
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
      ctx.lineWidth = 4;
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

    const zoomScale = 6;
    canvas.width = ATTR_BLOCK * zoomScale;
    canvas.height = ATTR_BLOCK * zoomScale;

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
          ctx.fillRect(x * zoomScale, y * zoomScale, zoomScale, zoomScale);

          // Highlight pixels that are causing errors (beyond first 2 colors)
          if (blockColors.length > 2 && blockColors.indexOf(color.value) >= 2) {
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 2;
            ctx.strokeRect(x * zoomScale, y * zoomScale, zoomScale, zoomScale);
          }
        }
      }
    }

    // Draw pixel grid
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= ATTR_BLOCK; x++) {
      ctx.beginPath();
      ctx.moveTo(x * zoomScale, 0);
      ctx.lineTo(x * zoomScale, ATTR_BLOCK * zoomScale);
      ctx.stroke();
    }
    for (let y = 0; y <= ATTR_BLOCK; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * zoomScale);
      ctx.lineTo(ATTR_BLOCK * zoomScale, y * zoomScale);
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

    const error = blockErrors.find(e => e.bx === bx && e.by === by);

    if (error) {
      setSelectedBlockError(error);
    } else {
      const colors = getBlockColors(bx, by);
      setSelectedBlockError({ bx, by, colors });
    }

    setSelectedPixel(null);
  };

  const handlePixelClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedBlockError || !screen.pixels) return;

    const canvas = zoomedCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const zoomScale = 6;
    const localX = Math.floor((e.clientX - rect.left) / zoomScale);
    const localY = Math.floor((e.clientY - rect.top) / zoomScale);

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

  const applyPixelColor = (targetColorValue: string) => {
    if (!screen.pixels || !selectedBlockError || !selectedPixel) return;

    const targetColor =
      SPECTRUM_COLORS.find(c => c.value === targetColorValue) || SPECTRUM_COLORS[0];

    const globalX = selectedBlockError.bx + selectedPixel.localX;
    const globalY = selectedBlockError.by + selectedPixel.localY;

    const newPixels = screen.pixels.map((row, y) =>
      y === globalY ? row.map((col, x) => (x === globalX ? targetColor : col)) : row
    );

    onScreenChange({ ...screen, pixels: newPixels });
    setSelectedPixel({ ...selectedPixel, color: targetColor });

    setTimeout(() => analyzeBlocks(newPixels), 0);
  };

  const handleSetPixelToInk = () => {
    if (!selectedBlockError) return;
    const blockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    if (blockColors.length === 0) return;
    applyPixelColor(blockColors[0]);
  };

  const handleSetPixelToPaper = () => {
    if (!selectedBlockError) return;
    const blockColors = getBlockColors(selectedBlockError.bx, selectedBlockError.by);
    if (blockColors.length === 0) return;
    const target = blockColors[1] || blockColors[0];
    applyPixelColor(target);
  };

  const handleExportSCR = () => {
    if (!screen.pixels || blockErrors.length > 0) {
      toast.error("Cannot export: blocks still have errors");
      return;
    }

    // Create SCR file data
    const scrData = new Uint8Array(6912);
    let offset = 0;

    // TODO: Implement proper ZX Spectrum screen format
    // For now, placeholder
    toast.success("SCR export (placeholder - needs implementation)");
  };

  const handleUseAsLoadingScreen = () => {
    if (blockErrors.length > 0) {
      toast.error("Cannot use: blocks still have errors");
      return;
    }

    toast.success("Loading screen set! This will appear first in TAP export.");
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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-bold mb-4">Loading Screen Creator</h2>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="final" disabled={!screen.pixels}>
              Final Artwork
            </TabsTrigger>
            <TabsTrigger value="stripped" disabled={blockErrors.length > 0}>
              Stripped Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a PNG to convert into a ZX Spectrum loading screen
              </p>
              <Button onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
                {analyzing ? "Processing..." : "Choose Image"}
              </Button>
            </div>
          </TabsContent>

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Main Canvas</Label>
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

                {blockErrors.length > 0 && (
                  <div className="mt-4 p-4 border border-border rounded">
                    <h3 className="font-semibold mb-2">Error Blocks</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {blockErrors.map((error, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedBlockError(error)}
                          className={`w-full text-left text-sm p-2 rounded hover:bg-muted ${
                            selectedBlockError === error ? "bg-muted" : ""
                          }`}
                        >
                          Block ({error.bx / 8}, {error.by / 8}) - {error.colors.length} colors
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedBlockError && (
                <div>
                  <Label className="mb-2 block">
                    Block Editor ({selectedBlockError.bx / 8}, {selectedBlockError.by / 8})
                  </Label>
                  <div className="border border-border rounded p-2 bg-black inline-block">
                    <canvas
                      ref={zoomedCanvasRef}
                      onClick={handlePixelClick}
                      className="cursor-pointer"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click pixels highlighted in red to fix them. Target: ≤2 colors per block.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="stripped" className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-semibold">Conversion Options</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Paper Color</Label>
                  <Select
                    value={paperColor.name}
                    onValueChange={(v) => setPaperColor(SPECTRUM_COLORS.find(c => c.name === v)!)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECTRUM_COLORS.map(color => (
                        <SelectItem key={color.name} value={color.name}>
                          {color.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Single-color blocks as</Label>
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
                  <Label>Preserve neighboring colors</Label>
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
                  ref={canvasRef}
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
