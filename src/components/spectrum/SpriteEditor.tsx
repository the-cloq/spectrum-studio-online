import { useState, useRef, useEffect } from "react";
import { SPECTRUM_COLORS, type Sprite, type SpectrumColor, type SpriteSize } from "@/types/spectrum";
import { ColorPalette } from "./ColorPalette";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Eraser, Grid3x3, ZoomIn, ZoomOut, Plus, Trash2, Play, Pause, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const countUsedColors = (pixels: number[][]) => {
  const colors = new Set<number>();

  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const value = pixels[y][x];
      if (value !== 0) { // ignore transparent
        colors.add(value);
      }
    }
  }

  return colors.size;
};

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
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [draggedFrameIndex, setDraggedFrameIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const sprite = sprites.find(s => s.id === selectedSpriteId) || sprites[0];
  const [width, height] = sprite ? sprite.size.split("x").map(Number) : [8, 8];
  const currentFrame = sprite?.frames?.[currentFrameIndex];

  useEffect(() => {
    drawSprite();
  }, [sprite, zoom, showGrid, currentFrameIndex]);

  // Animation preview loop
  useEffect(() => {
    if (!isPlaying || !sprite || sprite.frames.length <= 1) return;

    const fps = sprite.animationSpeed || 4;
    const interval = setInterval(() => {
      setPreviewFrame((prev) => (prev + 1) % sprite.frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, sprite]);

  useEffect(() => {
    drawPreview();
  }, [sprite, previewFrame]);

  const drawSprite = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite || !currentFrame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * zoom;
    canvas.height = height * zoom;

    // Draw pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = currentFrame.pixels[y]?.[x] ?? 0;
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

  const drawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !sprite) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const previewZoom = 4;
    canvas.width = width * previewZoom;
    canvas.height = height * previewZoom;

    const frame = sprite.frames[previewFrame];
    if (!frame) return;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = frame.pixels[y]?.[x] ?? 0;
        const color = SPECTRUM_COLORS[colorIndex];
        ctx.fillStyle = color.value;
        ctx.fillRect(x * previewZoom, y * previewZoom, previewZoom, previewZoom);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite || !currentFrame) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const newPixels = currentFrame.pixels.map(row => [...row]);
      if (!newPixels[y]) newPixels[y] = new Array(width).fill(0);

      const colorIndex = isErasing
        ? 0
        : SPECTRUM_COLORS.findIndex(
            c => c.ink === selectedColor.ink && c.bright === selectedColor.bright
          );

      newPixels[y][x] = colorIndex;

      const colourCount = countUsedColors(newPixels);

      if (colourCount > 2) {
        toast.error("ZX Spectrum limit: Only 2 colours per sprite allowed.");
        return;
      }

      const updatedFrames = sprite.frames.map((f, i) =>
        i === currentFrameIndex ? { ...f, pixels: newPixels } : f
      );

      const updatedSprites = sprites.map(s =>
        s.id === sprite.id ? { ...sprite, frames: updatedFrames } : s
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

  const clearFrame = () => {
    if (!sprite || !currentFrame) return;
    const newPixels = Array(height).fill(null).map(() => Array(width).fill(0));
    const updatedFrames = sprite.frames.map((f, i) =>
      i === currentFrameIndex ? { ...f, pixels: newPixels } : f
    );
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...sprite, frames: updatedFrames } : s
    );
    onSpritesChange(updatedSprites);
  };

  const changeSpriteSize = (size: SpriteSize) => {
    if (!sprite) return;
    const [newWidth, newHeight] = size.split("x").map(Number);
    const newPixels = Array(newHeight).fill(null).map(() => Array(newWidth).fill(0));
    const updatedFrames = sprite.frames.map(() => ({ pixels: newPixels }));
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...sprite, size, frames: updatedFrames } : s
    );
    onSpritesChange(updatedSprites);
    setCurrentFrameIndex(0);
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
      frames: [{ pixels: Array(h).fill(null).map(() => Array(w).fill(0)) }],
      animationSpeed: 4,
    };

    onSpritesChange([...sprites, newSprite]);
    setSelectedSpriteId(newSprite.id);
    setCurrentFrameIndex(0);
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

  const handleAddFrame = () => {
    if (!sprite) return;
    const newFrame = { pixels: Array(height).fill(null).map(() => Array(width).fill(0)) };
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, frames: [...s.frames, newFrame] } : s
    );
    onSpritesChange(updatedSprites);
    setCurrentFrameIndex(sprite.frames.length);
    toast.success("Frame added");
  };

  const handleDuplicateFrame = () => {
    if (!sprite || !currentFrame) return;
    const duplicatedFrame = { pixels: currentFrame.pixels.map(row => [...row]) };
    const updatedFrames = [...sprite.frames];
    updatedFrames.splice(currentFrameIndex + 1, 0, duplicatedFrame);
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, frames: updatedFrames } : s
    );
    onSpritesChange(updatedSprites);
    setCurrentFrameIndex(currentFrameIndex + 1);
    toast.success("Frame duplicated");
  };

  const handleDeleteFrame = () => {
    if (!sprite || sprite.frames.length <= 1) {
      toast.error("Cannot delete the last frame");
      return;
    }
    const updatedFrames = sprite.frames.filter((_, i) => i !== currentFrameIndex);
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, frames: updatedFrames } : s
    );
    onSpritesChange(updatedSprites);
    setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1));
    toast.success("Frame deleted");
  };

  const handleAnimationSpeedChange = (value: number[]) => {
    if (!sprite) return;
    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, animationSpeed: value[0] } : s
    );
    onSpritesChange(updatedSprites);
  };

  const handleFrameDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFrameIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFrameDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleFrameDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedFrameIndex === null || !sprite || draggedFrameIndex === dropIndex) return;

    const updatedFrames = [...sprite.frames];
    const [draggedFrame] = updatedFrames.splice(draggedFrameIndex, 1);
    updatedFrames.splice(dropIndex, 0, draggedFrame);

    const updatedSprites = sprites.map(s =>
      s.id === sprite.id ? { ...s, frames: updatedFrames } : s
    );
    onSpritesChange(updatedSprites);

    // Adjust current frame index if needed
    if (currentFrameIndex === draggedFrameIndex) {
      setCurrentFrameIndex(dropIndex);
    } else if (draggedFrameIndex < currentFrameIndex && dropIndex >= currentFrameIndex) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    } else if (draggedFrameIndex > currentFrameIndex && dropIndex <= currentFrameIndex) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }

    setDraggedFrameIndex(null);
    toast.success("Frame reordered");
  };

  const handleFrameDragEnd = () => {
    setDraggedFrameIndex(null);
  };

  if (!sprite) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main Canvas */}
      <Card className="p-4 lg:col-span-3">
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
            <Button variant="destructive" size="sm" onClick={clearFrame}>
              Clear Frame
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

          <div className="text-xs text-muted-foreground mt-2 text-center">
            Colours used in frame: {currentFrame ? countUsedColors(currentFrame.pixels) : 0} / 2
          </div>

          {/* Frame Timeline */}
          <Card className="p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Frame Timeline</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleAddFrame}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={handleDuplicateFrame}>
                  <Copy className="w-3 h-3 mr-1" />
                  Duplicate
                </Button>
                {sprite && sprite.frames.length > 1 && (
                  <Button size="sm" variant="destructive" onClick={handleDeleteFrame}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {sprite?.frames.map((_, i) => (
                <button
                  key={i}
                  draggable
                  onClick={() => setCurrentFrameIndex(i)}
                  onDragStart={(e) => handleFrameDragStart(e, i)}
                  onDragOver={handleFrameDragOver}
                  onDrop={(e) => handleFrameDrop(e, i)}
                  onDragEnd={handleFrameDragEnd}
                  className={cn(
                    "px-4 py-2 rounded border-2 transition-colors min-w-20 cursor-move",
                    i === currentFrameIndex
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:border-primary/50",
                    draggedFrameIndex === i && "opacity-50"
                  )}
                >
                  Frame {i + 1}
                </button>
              ))}
            </div>
          </Card>

          {/* Animation Preview */}
          {sprite && sprite.frames.length > 1 && (
            <Card className="p-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Animation Preview</h3>
              
              <div className="flex items-center gap-4 mb-4">
                <canvas
                  ref={previewCanvasRef}
                  className="border border-border pixelated"
                  style={{ imageRendering: "pixelated" }}
                />
                
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={isPlaying ? "default" : "outline"}
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      Animation Speed: {sprite.animationSpeed} fps
                    </Label>
                    <Slider
                      value={[sprite.animationSpeed]}
                      onValueChange={handleAnimationSpeedChange}
                      min={1}
                      max={12}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Preview only - game speed set in Object config
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}
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
