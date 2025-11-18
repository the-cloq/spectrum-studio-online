import { useState, useRef, useEffect } from "react";
import { SPECTRUM_COLORS, type Sprite, type SpectrumColor, type SpriteSize } from "@/types/spectrum";
import { ColorPalette } from "./ColorPalette";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eraser, Grid3x3, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpriteEditorProps {
  sprite: Sprite;
  onSpriteChange: (sprite: Sprite) => void;
}

const SPRITE_SIZES: { value: SpriteSize; label: string }[] = [
  { value: "8x8", label: "8×8" },
  { value: "16x16", label: "16×16" },
  { value: "24x12", label: "24×12" },
  { value: "32x16", label: "32×16" },
];

export const SpriteEditor = ({ sprite, onSpriteChange }: SpriteEditorProps) => {
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[7]); // White
  const [isErasing, setIsErasing] = useState(false);
  const [zoom, setZoom] = useState(16);
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [width, height] = sprite.size.split("x").map(Number);

  useEffect(() => {
    drawSprite();
  }, [sprite, zoom, showGrid]);

  const drawSprite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * zoom;
    canvas.height = height * zoom;

    // Draw pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = sprite.pixels[y]?.[x] ?? 0;
        const color = SPECTRUM_COLORS[colorIndex];
        ctx.fillStyle = color.value;
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom, 0);
        ctx.lineTo(x * zoom, height * zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom);
        ctx.lineTo(width * zoom, y * zoom);
        ctx.stroke();
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const newPixels = sprite.pixels.map(row => [...row]);
      if (!newPixels[y]) newPixels[y] = new Array(width).fill(0);
      
      const colorIndex = isErasing ? 0 : SPECTRUM_COLORS.findIndex(
        c => c.ink === selectedColor.ink && c.bright === selectedColor.bright
      );
      newPixels[y][x] = colorIndex;

      onSpriteChange({ ...sprite, pixels: newPixels });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSprite = () => {
    const newPixels = Array(height).fill(null).map(() => Array(width).fill(0));
    onSpriteChange({ ...sprite, pixels: newPixels });
  };

  const changeSpriteSize = (size: SpriteSize) => {
    const [newWidth, newHeight] = size.split("x").map(Number);
    const newPixels = Array(newHeight).fill(null).map(() => Array(newWidth).fill(0));
    onSpriteChange({ ...sprite, size, pixels: newPixels });
  };

  return (
    <div className="flex gap-4">
      <Card className="p-4 flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Sprite Editor</h2>
          <div className="flex gap-2">
            {SPRITE_SIZES.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={sprite.size === value ? "default" : "outline"}
                onClick={() => changeSpriteSize(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isErasing ? "default" : "outline"}
            onClick={() => setIsErasing(!isErasing)}
          >
            <Eraser className="w-4 h-4 mr-2" />
            Erase
          </Button>
          <Button
            size="sm"
            variant={showGrid ? "default" : "outline"}
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            Grid
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(Math.max(8, zoom - 4))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(Math.min(32, zoom + 4))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={clearSprite}
          >
            Clear
          </Button>
        </div>

        <div className="flex justify-center p-4 bg-muted rounded border border-border">
          <canvas
            ref={canvasRef}
            className={cn("cursor-crosshair", isErasing && "cursor-cell")}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </Card>

      <Card className="p-4 w-64">
        <ColorPalette
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
        />
      </Card>
    </div>
  );
};
