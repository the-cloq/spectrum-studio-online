import { useState, useRef, useEffect } from "react";
import { SPECTRUM_COLORS, type Sprite, type SpectrumColor, type SpriteSize } from "@/types/spectrum";
import { ColorPalette } from "./ColorPalette";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eraser, Grid3x3, ZoomIn, ZoomOut, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SpriteEditorProps {
  sprites: Sprite[];
  onSpritesChange: (sprites: Sprite[]) => void;
}

const SPRITE_SIZES: { value: SpriteSize; label: string }[] = [
  { value: "8x8", label: "8×8" },
  { value: "16x16", label: "16×16" },
  { value: "24x12", label: "24×12" },
  { value: "32x16", label: "32×16" },
];

export const SpriteEditor = ({ sprites, onSpritesChange }: SpriteEditorProps) => {
  const [selectedSpriteId, setSelectedSpriteId] = useState(sprites[0]?.id);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[7]); // White
  const [isErasing, setIsErasing] = useState(false);
  const [zoom, setZoom] = useState(16);
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newSpriteName, setNewSpriteName] = useState("");
  const [newSpriteSize, setNewSpriteSize] = useState<SpriteSize>("8x8");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sprite = sprites.find(s => s.id === selectedSpriteId) || sprites[0];
  const [width, height] = sprite ? sprite.size.split("x").map(Number) : [8, 8];

  useEffect(() => {
    drawSprite();
  }, [sprite, zoom, showGrid]);

  const drawSprite = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;

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
    if (!canvas || !sprite) return;

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

      const updatedSprites = sprites.map(s => 
        s.id === sprite.id ? { ...sprite, pixels: newPixels } : s
      );
      onSpritesChange(updatedSprites);
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
    if (!sprite) return;
    const newPixels = Array(height).fill(null).map(() => Array(width).fill(0));
    const updatedSprites = sprites.map(s => 
      s.id === sprite.id ? { ...sprite, pixels: newPixels } : s
    );
    onSpritesChange(updatedSprites);
  };

  const changeSpriteSize = (size: SpriteSize) => {
    if (!sprite) return;
    const [newWidth, newHeight] = size.split("x").map(Number);
    const newPixels = Array(newHeight).fill(null).map(() => Array(newWidth).fill(0));
    const updatedSprites = sprites.map(s => 
      s.id === sprite.id ? { ...sprite, size, pixels: newPixels } : s
    );
    onSpritesChange(updatedSprites);
  };

  const handleAddSprite = () => {
    if (!newSpriteName.trim()) {
      toast.error("Please enter a sprite name");
      return;
    }

    const [w, h] = newSpriteSize.split("x").map(Number);
    const newSprite: Sprite = {
      id: `sprite-${Date.now()}`,
      name: newSpriteName,
      size: newSpriteSize,
      pixels: Array(h).fill(null).map(() => Array(w).fill(0)),
    };

    onSpritesChange([...sprites, newSprite]);
    setSelectedSpriteId(newSprite.id);
    setNewSpriteName("");
    toast.success(`Sprite "${newSprite.name}" added to library!`);
  };

  const handleDeleteSprite = (spriteId: string) => {
    if (sprites.length === 1) {
      toast.error("Cannot delete the last sprite");
      return;
    }
    
    const filtered = sprites.filter(s => s.id !== spriteId);
    onSpritesChange(filtered);
    
    if (selectedSpriteId === spriteId) {
      setSelectedSpriteId(filtered[0]?.id);
    }
    
    toast.success("Sprite deleted");
  };

  const handleSpriteNameChange = (name: string) => {
    if (!sprite) return;
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, name } : s
    );
    onSpritesChange(updatedSprites);
  };

  if (!sprite) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Canvas */}
      <Card className="p-4 lg:col-span-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="sprite-name">Sprite Name</Label>
              <Input
                id="sprite-name"
                value={sprite.name}
                onChange={(e) => handleSpriteNameChange(e.target.value)}
                className="max-w-xs"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={sprite.size} onValueChange={changeSpriteSize}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPRITE_SIZES.map(size => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={!isErasing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsErasing(false)}
            >
              Draw
            </Button>
            <Button
              variant={isErasing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsErasing(true)}
            >
              <Eraser className="w-4 h-4 mr-2" />
              Erase
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGrid(!showGrid)}>
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(8, zoom - 4))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(32, zoom + 4))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={clearSprite}>
              Clear
            </Button>
          </div>

          <div className="border-2 border-border rounded-lg p-4 bg-muted/50 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className={cn(
                "border border-border cursor-crosshair pixelated",
                "shadow-lg"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        </div>
      </Card>

      {/* Sprite Library */}
      <Card className="p-4">
        <h2 className="text-lg font-bold text-primary mb-4">Sprite Library</h2>
        
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {sprites.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                s.id === selectedSpriteId ? "bg-primary/20 border border-primary" : "hover:bg-muted"
              }`}
              onClick={() => setSelectedSpriteId(s.id)}
            >
              <div className="flex-1">
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.size}</div>
              </div>
              {sprites.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSprite(s.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-3 border-t">
          <div>
            <Label htmlFor="new-sprite-name">New Sprite Name</Label>
            <Input
              id="new-sprite-name"
              value={newSpriteName}
              onChange={(e) => setNewSpriteName(e.target.value)}
              placeholder="e.g., Wall, Player, Enemy"
            />
          </div>

          <div>
            <Label htmlFor="new-sprite-size">Size</Label>
            <Select value={newSpriteSize} onValueChange={(v) => setNewSpriteSize(v as SpriteSize)}>
              <SelectTrigger id="new-sprite-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8x8">8x8 (Block)</SelectItem>
                <SelectItem value="16x16">16x16 (Standard)</SelectItem>
                <SelectItem value="24x12">24x12 (JetPac style)</SelectItem>
                <SelectItem value="32x16">32x16 (Large)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAddSprite} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add to Library
          </Button>
        </div>
      </Card>

      {/* Color Palette */}
      <Card className="p-4 lg:col-span-3">
        <h3 className="text-sm font-semibold mb-3 text-foreground">ZX Spectrum Colors</h3>
        <ColorPalette
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
        />
      </Card>
    </div>
  );
};
