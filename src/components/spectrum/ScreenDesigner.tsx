import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { type Screen, type Block, type SpectrumColor } from "@/types/spectrum";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

// Standard ZX Spectrum screen is 32x24 characters (256x192 pixels)
const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;
const TILE_SIZE = 16; // Display size in pixels
const LOADING_TILE_SCALE = 2; // 2x2 for loading/title screens

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor | null>(null);
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState("game");
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    if (!selectedScreen || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const tileScale = selectedScreen.type === "title" ? LOADING_TILE_SCALE : TILE_SIZE;
    const width = selectedScreen.width * tileScale;
    const height = selectedScreen.height * tileScale;

    canvasRef.current.width = width;
    canvasRef.current.height = height;

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Draw tiles
    for (let y = 0; y < selectedScreen.height; y++) {
      for (let x = 0; x < selectedScreen.width; x++) {
        const blockId = selectedScreen.tiles[y]?.[x];
        if (blockId) {
          const block = blocks.find(b => b.id === blockId);
          if (block?.sprite) drawBlockOnCanvas(ctx, block, x * tileScale, y * tileScale, tileScale);
        }
      }
    }

    // Type pill
    ctx.fillStyle = "#ffcc00";
    ctx.font = `${Math.floor(tileScale * 0.8)}px monospace`;
    ctx.fillText(selectedScreen.type.toUpperCase(), 5, Math.min(tileScale * 1.5, 20));
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, scale: number) => {
    const sprite = block.sprite;
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
          ctx.fillRect(x + px * (scale / 8), y + py * (scale / 8), scale / 8, scale / 8);
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const tileScale = selectedScreen.type === "title" ? LOADING_TILE_SCALE : TILE_SIZE;
    const x = Math.floor((e.clientX - rect.left) / tileScale);
    const y = Math.floor((e.clientY - rect.top) / tileScale);

    if (x >= 0 && x < selectedScreen.width && y >= 0 && y < selectedScreen.height) {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      if (!newTiles[y]) newTiles[y] = Array(selectedScreen.width).fill("");

      if (isErasing) {
        newTiles[y][x] = "";
      } else if (selectedBlock) {
        newTiles[y][x] = selectedBlock.id;
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
    if (!screenName || !screenType) return;
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: screenName,
      type: screenType,
      width: screenType === "title" ? 2 : SCREEN_WIDTH,
      height: screenType === "title" ? 2 : SCREEN_HEIGHT,
      tiles: Array(screenType === "title" ? 2 : SCREEN_HEIGHT).fill(null).map(() => Array(screenType === "title" ? 2 : SCREEN_WIDTH).fill("")),
    };
    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setScreenName("");
    toast.success("Screen created!");
  };

  const handleDeleteScreen = (screenId: string) => {
    const updated = screens.filter(s => s.id !== screenId);
    onScreensChange(updated);
    if (selectedScreen?.id === screenId) setSelectedScreen(updated[0] || null);
    toast.success("Screen deleted!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas Panel */}
      <Card className="p-4 lg:col-span-3">
        <div className="mb-2">
          {selectedScreen && (
            <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>
          )}
        </div>
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
        <div className="mt-4">
          <ColorPalette
            selectedColor={selectedColor || { name: "White", ink: 7, bright: true, value: "#FFFFFF" }}
            onColorSelect={setSelectedColor}
          />
        </div>
      </Card>

      {/* Right Column */}
      <div className="space-y-4">
        <Card className="p-4">
          <Label htmlFor="screen-name" className="text-xs font-bold text-primary">Screen Name</Label>
          <Input
            id="screen-name"
            placeholder="Enter screen name"
            value={screenName}
            onChange={e => setScreenName(e.target.value)}
            className="mb-2"
          />
          <Select onValueChange={setScreenType} value={screenType}>
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
            className="mt-2 w-full"
            onClick={handleAddScreen}
            disabled={!screenName || !screenType}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Screen
          </Button>

          {/* Screen List */}
          <div className="mt-4 space-y-2 max-h-64 overflow-auto">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  selectedScreen?.id === screen.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedScreen(screen)}
              >
                <span className="truncate">{screen.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={e => { e.stopPropagation(); handleDeleteScreen(screen.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
