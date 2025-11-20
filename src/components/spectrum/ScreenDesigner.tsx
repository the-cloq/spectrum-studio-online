import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Screen, type Block, type ScreenType } from "@/types/spectrum";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Grid3x3, Eraser } from "lucide-react";
import { toast } from "sonner";

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
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync selectedScreen if screens prop changes (keeps selection valid)
  useEffect(() => {
    if (!selectedScreen && screens.length > 0) {
      setSelectedScreen(screens[0]);
      return;
    }
    if (selectedScreen) {
      const found = screens.find(s => s.id === selectedScreen.id);
      if (found) {
        setSelectedScreen(found);
      } else {
        setSelectedScreen(screens[0] || null);
      }
    }
  }, [screens]);

  // Draw whenever selectedScreen or blocks change
  useEffect(() => {
    drawScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScreen, blocks]);

  const drawScreen = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || !selectedScreen) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // set size (ensures pixel-perfect rendering)
      canvas.width = SCREEN_WIDTH * TILE_SIZE;
      canvas.height = SCREEN_HEIGHT * TILE_SIZE;

      ctx.imageSmoothingEnabled = false;

      // Draw background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines (lighter for readability)
      ctx.strokeStyle = "rgba(100, 100, 100, 0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= SCREEN_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE, 0);
        ctx.lineTo(x * TILE_SIZE, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= SCREEN_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE);
        ctx.lineTo(canvas.width, y * TILE_SIZE);
        ctx.stroke();
      }

      // Draw tiles safely
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const row = selectedScreen.tiles?.[y];
          if (!row) continue;
          const blockId = row[x];
          if (!blockId) continue; // treat "", null, undefined as empty
          const block = blocks.find(b => b.id === blockId);
          if (block?.sprite) {
            try {
              drawBlockOnCanvas(ctx, block, x * TILE_SIZE, y * TILE_SIZE);
            } catch (err) {
              // keep drawing even if one block has bad data
              // eslint-disable-next-line no-console
              console.warn("Failed drawing block:", blockId, err);
            }
          }
        }
      }
    } catch (err) {
      // defensive: don't allow a canvas error to crash the whole UI
      // eslint-disable-next-line no-console
      console.error("drawScreen error", err);
      toast.error("Error drawing screen (see console)");
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number) => {
    const sprite = block.sprite;
    if (!sprite) return;
    if (!sprite.size || !sprite.pixels) return;

    const [width, height] = sprite.size.split("x").map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;

    // sprite.pixels expected as array of rows -> array of color indices
    const baseSize = 8; // pixels per base cell (we assume sprite.pixels is width x height)
    const pixelScale = TILE_SIZE / baseSize;

    const spectrumColors = [
      "#000000", "#0000D7", "#D70000", "#D700D7",
      "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
      "#000000", "#0000FF", "#FF0000", "#FF00FF",
      "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
    ];

    // Defensive loop - ensure dimensions match pixel matrix
    for (let py = 0; py < sprite.pixels.length; py++) {
      const row = sprite.pixels[py];
      if (!row) continue;
      for (let px = 0; px < row.length; px++) {
        const colorIndex = row[px];
        if (colorIndex === 0 || colorIndex == null) continue;
        const color = (colorIndex > 0 && colorIndex <= 15) ? spectrumColors[colorIndex] : "#FFFFFF";
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(x + px * pixelScale),
          Math.round(y + py * pixelScale),
          Math.max(1, Math.round(pixelScale)),
          Math.max(1, Math.round(pixelScale))
        );
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;

    // clone tiles safely and ensure row exists
    const newTiles = selectedScreen.tiles.map(row => (row ? [...row] : new Array(SCREEN_WIDTH).fill("")));

    if (!newTiles[y]) newTiles[y] = new Array(SCREEN_WIDTH).fill("");

    if (isErasing) {
      newTiles[y][x] = "";
    } else if (selectedBlock) {
      // Calculate how many tiles this block occupies
      const [spriteWidth, spriteHeight] = selectedBlock.sprite?.size.split("x").map(Number) ?? [8, 8];
      const tilesWide = Math.max(1, Math.ceil(spriteWidth / 8));
      const tilesHigh = Math.max(1, Math.ceil(spriteHeight / 8));

      // Place the block ID in all tiles it occupies (guard boundaries)
      for (let dy = 0; dy < tilesHigh && (y + dy) < SCREEN_HEIGHT; dy++) {
        if (!newTiles[y + dy]) newTiles[y + dy] = new Array(SCREEN_WIDTH).fill("");
        for (let dx = 0; dx < tilesWide && (x + dx) < SCREEN_WIDTH; dx++) {
          newTiles[y + dy][x + dx] = selectedBlock.id;
        }
      }
    }

    const updatedScreen = { ...selectedScreen, tiles: newTiles };
    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(updatedScreen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) handleCanvasClick(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCreateScreen = () => {
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: `Screen ${screens.length + 1}`,
      type: "level",
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      tiles: Array.from({ length: SCREEN_HEIGHT }, () => Array(SCREEN_WIDTH).fill("")),
    };
    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
  };

  const handleScreenTypeChange = (screenId: string, newType: ScreenType) => {
    const updatedScreens = screens.map(screen =>
      screen.id === screenId ? { ...screen, type: newType } : screen
    );
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === screenId) {
      setSelectedScreen({ ...selectedScreen, type: newType });
    }
  };

  const handleDeleteScreen = (screenId: string) => {
    const updatedScreens = screens.filter(s => s.id !== screenId);
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === screenId) {
      setSelectedScreen(updatedScreens[0] || null);
    }
    toast.success("Screen deleted");
  };

  const handleClearScreen = () => {
    if (!selectedScreen) return;
    const clearedScreen = {
      ...selectedScreen,
      tiles: Array.from({ length: SCREEN_HEIGHT }, () => Array(SCREEN_WIDTH).fill("")),
    };
    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? clearedScreen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(clearedScreen);
    toast.success("Screen cleared");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Screen Canvas */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 space-y-2">
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && (
              <div className="flex gap-2 items-center">
                <Input
                  value={selectedScreen.name}
                  onChange={(e) => {
                    const updatedScreens = screens.map(s =>
                      s.id === selectedScreen.id ? { ...s, name: e.target.value } : s
                    );
                    onScreensChange(updatedScreens);
                    setSelectedScreen({ ...selectedScreen, name: e.target.value });
                  }}
                  className="max-w-xs bg-background"
                />
                <Select
                  value={selectedScreen.type ?? "level"}
                  onValueChange={(value: ScreenType) => handleScreenTypeChange(selectedScreen.id, value)}
                >
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
            )}
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
            <Button size="sm" variant="outline" onClick={handleClearScreen}>
              Clear Screen
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
            <Button className="mt-4" onClick={handleCreateScreen}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Screen
            </Button>
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Screen List */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-primary">Screens</h3>
            <Button size="sm" variant="outline" onClick={handleCreateScreen}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {screens.map((screen) => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  selectedScreen?.id === screen.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedScreen(screen)}
              >
                <span className="text-sm truncate flex-1">{screen.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteScreen(screen.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Block Palette */}
        <Card className="p-4">
          <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Create blocks first
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {blocks.map((block) => (
                <button
                  key={block.id}
                  className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${
                    selectedBlock?.id === block.id && !isErasing
                      ? "border-primary retro-glow"
                      : "border-border"
                  }`}
                  onClick={() => {
                    setSelectedBlock(block);
                    setIsErasing(false);
                  }}
                  title={block.name}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-xs font-bold">
                      {block.name.substring(0, 1)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
