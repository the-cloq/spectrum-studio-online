import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Screen, type Block, type ScreenType } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;
const TILE_SIZE = 16;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw screen whenever selectedScreen or blocks change
  useEffect(() => {
    if (selectedScreen) {
      drawScreen(selectedScreen);
    }
  }, [selectedScreen, blocks]);

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number) => {
    const sprite = block.sprite;
    const [width, height] = sprite.size.split("x").map(Number);
    const pixelScale = TILE_SIZE / 8;

    sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex !== 0) {
          const spectrumColors = [
            "#000000", "#0000D7", "#D70000", "#D700D7",
            "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
            "#000000", "#0000FF", "#FF0000", "#FF00FF",
            "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
          ];
          ctx.fillStyle = spectrumColors[colorIndex] || "#000";
          ctx.fillRect(
            x + px * pixelScale,
            y + py * pixelScale,
            pixelScale,
            pixelScale
          );
        }
      });
    });
  };

  const drawScreen = (screen: Screen) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SCREEN_WIDTH * TILE_SIZE;
    canvas.height = SCREEN_HEIGHT * TILE_SIZE;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
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

    // Tiles
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const blockId = screen.tiles[y]?.[x];
        if (blockId) {
          const block = blocks.find(b => b.id === blockId);
          if (block) drawBlockOnCanvas(ctx, block, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }

    // Generate thumbnail after draw
    generateThumbnail(screen);
  };

  const generateThumbnail = (screen: Screen) => {
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_WIDTH * TILE_SIZE;
    canvas.height = SCREEN_HEIGHT * TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const blockId = screen.tiles[y]?.[x];
        if (blockId) {
          const block = blocks.find(b => b.id === blockId);
          if (block) drawBlockOnCanvas(ctx, block, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }

    screen.thumbnail = canvas.toDataURL();
    const updatedScreens = screens.map(s => s.id === screen.id ? screen : s);
    onScreensChange(updatedScreens);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;

    const newTiles = selectedScreen.tiles.map(row => [...row]);
    if (!newTiles[y]) newTiles[y] = Array(SCREEN_WIDTH).fill("");

    if (isErasing) {
      newTiles[y][x] = "";
    } else if (selectedBlock) {
      const [w, h] = selectedBlock.sprite.size.split("x").map(Number);
      const tilesWide = Math.ceil(w / 8);
      const tilesHigh = Math.ceil(h / 8);
      for (let dy = 0; dy < tilesHigh && (y + dy) < SCREEN_HEIGHT; dy++) {
        for (let dx = 0; dx < tilesWide && (x + dx) < SCREEN_WIDTH; dx++) {
          if (!newTiles[y + dy]) newTiles[y + dy] = Array(SCREEN_WIDTH).fill("");
          newTiles[y + dy][x + dx] = selectedBlock.id;
        }
      }
    }

    const updatedScreen = { ...selectedScreen, tiles: newTiles };
    setSelectedScreen(updatedScreen);
    onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));

    generateThumbnail(updatedScreen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
  const handleMouseUp = () => setIsDrawing(false);

  const handleCreateScreen = () => {
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: `Screen ${screens.length + 1}`,
      type: "level",
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")),
    };
    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    generateThumbnail(newScreen);
  };

  const handleDeleteScreen = (screenId: string) => {
    const updatedScreens = screens.filter(s => s.id !== screenId);
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === screenId) setSelectedScreen(updatedScreens[0] || null);
    toast.success("Screen deleted");
  };

  const handleClearScreen = () => {
    if (!selectedScreen) return;
    const clearedScreen = { ...selectedScreen, tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")) };
    setSelectedScreen(clearedScreen);
    onScreensChange(screens.map(s => s.id === clearedScreen.id ? clearedScreen : s));
    generateThumbnail(clearedScreen);
    toast.success("Screen cleared");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          {selectedScreen && <Input
            value={selectedScreen.name}
            onChange={(e) => {
              const updated = { ...selectedScreen, name: e.target.value };
              setSelectedScreen(updated);
              onScreensChange(screens.map(s => s.id === updated.id ? updated : s));
            }}
            className="max-w-xs bg-background"
          />}
          <div className="flex gap-2">
            <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
              <Eraser className="w-4 h-4 mr-2" />Erase
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearScreen}>Clear Screen</Button>
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
            <Button onClick={handleCreateScreen}><Plus className="w-4 h-4 mr-2" />Create First Screen</Button>
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-primary">Screens</h3>
            <Button size="sm" variant="outline" onClick={handleCreateScreen}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-2">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
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

        {/* Block Palette */}
        <Card className="p-4">
          <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {blocks.map(block => (
                <button key={block.id} className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${selectedBlock?.id === block.id && !isErasing ? "border-primary retro-glow" : "border-border"}`}
                  onClick={() => { setSelectedBlock(block); setIsErasing(false); }}
                  title={block.name}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-xs font-bold">{block.name.substring(0, 1)}</div>
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
