import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { type Screen, type Block, type SpectrumColor } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { ColorPalette } from "@/components/spectrum/ColorPalette";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

// Standard ZX Spectrum screen is 32x24 characters (256x192 pixels)
const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;
const TILE_SIZE = 16; // Display size in pixels

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<Screen["type"] | "title" | "game" | "level" | "gameover" | "controls" | "">("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isTitle = selectedScreen.type === "title";
    const width = isTitle ? 2 : (selectedScreen.width || SCREEN_WIDTH);
    const height = isTitle ? 2 : (selectedScreen.height || SCREEN_HEIGHT);
    const tileScale = isTitle ? 96 : TILE_SIZE; // big enough for 2x2 to see

    canvas.width = width * tileScale;
    canvas.height = height * tileScale;

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileScale, 0);
      ctx.lineTo(x * tileScale, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileScale);
      ctx.lineTo(canvas.width, y * tileScale);
      ctx.stroke();
    }

    // Draw tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const blockId = selectedScreen.tiles[y]?.[x];
        if (blockId) {
          if (isTitle && selectedColor) {
            ctx.fillStyle = selectedColor.value;
            ctx.fillRect(x * tileScale, y * tileScale, tileScale, tileScale);
          } else {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlockOnCanvas(ctx, block, x * tileScale, y * tileScale, tileScale);
          }
        }
      }
    }

    // Draw type pill
    const typeText = (selectedScreen.type || "GAME").toUpperCase();
    ctx.fillStyle = "#ffcc00";
    ctx.font = `${Math.floor(tileScale * 0.8)}px monospace`;
    ctx.fillText(typeText, 5, Math.min(tileScale * 1.5, 20));
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, scale: number) => {
    const sprite = block.sprite;
    const [width, height] = sprite.size.split("x").map(Number);
    const pixelScale = scale / 8;

    sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex !== 0) {
          const spectrumColors = [
            "#000000", "#0000D7", "#D70000", "#D700D7",
            "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
            "#000000", "#0000FF", "#FF0000", "#FF00FF",
            "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
          ];
          ctx.fillStyle = spectrumColors[colorIndex] || "#000000";
          ctx.fillRect(x + px * pixelScale, y + py * pixelScale, pixelScale, pixelScale);
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const isTitle = selectedScreen.type === "title";
    const width = isTitle ? 2 : (selectedScreen.width || SCREEN_WIDTH);
    const height = isTitle ? 2 : (selectedScreen.height || SCREEN_HEIGHT);
    const tileScale = isTitle ? 96 : TILE_SIZE;

    const x = Math.floor((e.clientX - rect.left) / tileScale);
    const y = Math.floor((e.clientY - rect.top) / tileScale);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      if (!newTiles[y]) newTiles[y] = Array(width).fill("");

      if (isErasing) {
        newTiles[y][x] = "";
      } else if (isTitle && selectedColor) {
        newTiles[y][x] = "color"; // just a placeholder for title color
      } else if (selectedBlock) {
        const [spriteWidth, spriteHeight] = selectedBlock.sprite.size.split("x").map(Number);
        const tilesWide = Math.ceil(spriteWidth / 8);
        const tilesHigh = Math.ceil(spriteHeight / 8);
        for (let dy = 0; dy < tilesHigh && (y + dy) < height; dy++) {
          for (let dx = 0; dx < tilesWide && (x + dx) < width; dx++) {
            if (!newTiles[y + dy]) newTiles[y + dy] = Array(width).fill("");
            newTiles[y + dy][x + dx] = selectedBlock.id;
          }
        }
      }

      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
      onScreensChange(updatedScreens);
      setSelectedScreen(updatedScreen);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
  const handleMouseUp = () => setIsDrawing(false);

  const handleAddScreen = () => {
    if (!newScreenName || !newScreenType) return;
    const width = newScreenType === "title" ? 2 : SCREEN_WIDTH;
    const height = newScreenType === "title" ? 2 : SCREEN_HEIGHT;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: newScreenName,
      type: newScreenType,
      width,
      height,
      tiles: Array(height).fill(null).map(() => Array(width).fill("")),
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setNewScreenName("");
    setNewScreenType("");
    toast.success("Screen added!");
  };

  const handleDeleteScreen = (screenId: string) => {
    const updatedScreens = screens.filter(s => s.id !== screenId);
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === screenId) setSelectedScreen(updatedScreens[0] || null);
    toast.success("Screen deleted");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
              <Eraser className="w-4 h-4 mr-2" />Erase
            </Button>
          </div>
        </div>

        {selectedScreen ? (
          <div className="flex justify-center p-4 bg-muted rounded border border-border overflow-auto">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No screen selected</p>
          </div>
        )}

        {selectedScreen?.type === "title" && selectedColor && (
          <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} className="mt-4" />
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3">
            <Label>Screen Name</Label>
            <Input value={newScreenName} onChange={e => setNewScreenName(e.target.value)} />
          </div>
          <div className="mb-3">
            <Label>Screen Type</Label>
            <Select onValueChange={value => setNewScreenType(value as any)}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title Screen</SelectItem>
                <SelectItem value="game">Game Screen</SelectItem>
                <SelectItem value="level">Level Screen</SelectItem>
                <SelectItem value="gameover">Game Over</SelectItem>
                <SelectItem value="controls">Controls</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddScreen} disabled={!newScreenName || !newScreenType} className="mt-2 w-full">
            <Plus className="w-4 h-4 mr-2" /> Add Screen
          </Button>

          {/* Screen list */}
          <div className="mt-4 space-y-2">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedScreen(screen)}
              >
                <span className="text-sm truncate flex-1">{screen.name}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); handleDeleteScreen(screen.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Block palette only if not title */}
        {selectedScreen?.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map(b => (
                  <button
                    key={b.id}
                    className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${
                      selectedBlock?.id === b.id && !isErasing ? "border-primary retro-glow" : "border-border"
                    }`}
                    onClick={() => { setSelectedBlock(b); setIsErasing(false); }}
                    title={b.name}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-xs font-bold">{b.name.substring(0, 1)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
