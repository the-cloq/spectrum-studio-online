import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Screen, type Block } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { SPECTRUM_COLORS, type SpectrumColor } from "@/types/spectrum";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

// Standard ZX Spectrum screen
const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;
const TILE_SIZE = 16; // Display pixels
const TITLE_BLOCK_SIZE = 2; // 2x2 pixel blocks for Title screens

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<Screen["type"]>("game");
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[15]); // default white
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedScreen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = selectedScreen.type === "title" ? SCREEN_WIDTH * TITLE_BLOCK_SIZE : SCREEN_WIDTH;
    const height = selectedScreen.type === "title" ? SCREEN_HEIGHT * TITLE_BLOCK_SIZE : SCREEN_HEIGHT;
    const scale = selectedScreen.type === "title" ? TILE_SIZE / TITLE_BLOCK_SIZE : TILE_SIZE;

    canvas.width = width * scale;
    canvas.height = height * scale;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(canvas.width, y * scale);
      ctx.stroke();
    }

    // Draw blocks (normal screens) or pixels (title screens)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (selectedScreen.type === "title") {
          const color = selectedScreen.tiles[y]?.[x] || null;
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        } else {
          const blockId = selectedScreen.tiles[y]?.[x];
          if (blockId) {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlockOnCanvas(ctx, block, x * scale, y * scale, scale);
          }
        }
      }
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, scale: number) => {
    const sprite = block.sprite;
    const [width, height] = sprite.size.split("x").map(Number);
    const pixelScale = scale / 8;
    sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex !== 0) {
          let color = "#000000";
          if (colorIndex > 0 && colorIndex <= 15) {
            color = SPECTRUM_COLORS[colorIndex].value;
          }
          ctx.fillStyle = color;
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
    const scale = selectedScreen.type === "title" ? TILE_SIZE / TITLE_BLOCK_SIZE : TILE_SIZE;
    const width = selectedScreen.type === "title" ? SCREEN_WIDTH * TITLE_BLOCK_SIZE : SCREEN_WIDTH;
    const height = selectedScreen.type === "title" ? SCREEN_HEIGHT * TITLE_BLOCK_SIZE : SCREEN_HEIGHT;

    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);

    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const newTiles = selectedScreen.tiles.map(row => [...row]);
    if (!newTiles[y]) newTiles[y] = new Array(width).fill("");

    if (isErasing) {
      newTiles[y][x] = "";
    } else if (selectedScreen.type === "title") {
      newTiles[y][x] = selectedColor.value;
    } else if (selectedBlock) {
      newTiles[y][x] = selectedBlock.id;
    }

    const updatedScreen = { ...selectedScreen, tiles: newTiles };
    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(updatedScreen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
  const handleMouseUp = () => setIsDrawing(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas */}
      <Card className="p-4 lg:col-span-3 relative">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && (
              <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
              <Eraser className="w-4 h-4 mr-2" /> Erase
            </Button>
          </div>
        </div>

        {selectedScreen ? (
          <div className="relative flex justify-center p-4 bg-muted rounded border border-border overflow-auto">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ imageRendering: "pixelated" }}
            />
            {selectedScreen.type && (
              <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded-full">
                {selectedScreen.type}
              </span>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No screen selected</p>
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Name & Type + Add Screen */}
        <Card className="p-4">
          <Label>Screen Name</Label>
          <Input value={newScreenName} onChange={(e) => setNewScreenName(e.target.value)} placeholder="Enter screen name" />
          <Label className="mt-2">Screen Type</Label>
          <Select value={newScreenType} onValueChange={(value) => setNewScreenType(value as Screen["type"])}>
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
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              const newScreen: Screen = {
                id: `screen-${Date.now()}`,
                name: newScreenName,
                type: newScreenType,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")),
              };
              onScreensChange([...screens, newScreen]);
              setSelectedScreen(newScreen);
              setNewScreenName("");
              setNewScreenType("game");
              toast.success("Screen created!");
            }}
            disabled={!newScreenName || !newScreenType}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Screen
          </Button>
        </Card>

        {/* Color Palette for Title screens */}
        {selectedScreen?.type === "title" && (
          <Card className="p-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </Card>
        )}

        {/* Block Palette for normal screens */}
        {selectedScreen && selectedScreen.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map((block) => (
                  <button
                    key={block.id}
                    className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${
                      selectedBlock?.id === block.id && !isErasing ? "border-primary retro-glow" : "border-border"
                    }`}
                    onClick={() => { setSelectedBlock(block); setIsErasing(false); }}
                    title={block.name}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-xs font-bold">{block.name.substring(0, 1)}</div>
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
