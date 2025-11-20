import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { SPECTRUM_COLORS, type Screen, type Block, type SpectrumColor } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[15]); // default white
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState<Screen["type"] | "">("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    if (!selectedScreen || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const isTitle = selectedScreen.type === "title";
    const pixelSize = isTitle ? 2 : 8;
    const canvasWidth = SCREEN_WIDTH * 8 * pixelSize;
    const canvasHeight = SCREEN_HEIGHT * 8 * pixelSize;

    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= SCREEN_WIDTH * 8; x++) {
      ctx.beginPath();
      ctx.moveTo(x * pixelSize, 0);
      ctx.lineTo(x * pixelSize, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= SCREEN_HEIGHT * 8; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * pixelSize);
      ctx.lineTo(canvasWidth, y * pixelSize);
      ctx.stroke();
    }

    // Draw pixels
    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const blockId = selectedScreen.tiles[y]?.[x];
        if (blockId) {
          if (isTitle) {
            ctx.fillStyle = selectedColor.value;
            ctx.fillRect(
              x * 8 * pixelSize,
              y * 8 * pixelSize,
              8 * pixelSize,
              8 * pixelSize
            );
          } else {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlockOnCanvas(ctx, block, x * 8 * pixelSize, y * 8 * pixelSize, pixelSize);
          }
        }
      }
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, pixelSize: number) => {
    block.sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex !== 0) {
          const spectrumColors = [
            "#000000", "#0000D7", "#D70000", "#D700D7",
            "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
            "#000000", "#0000FF", "#FF0000", "#FF00FF",
            "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
          ];
          ctx.fillStyle = spectrumColors[colorIndex] || "#000";
          ctx.fillRect(x + px * pixelSize, y + py * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isTitle = selectedScreen.type === "title";
    const pixelSize = isTitle ? 2 : 8;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (pixelSize * 8));
    const y = Math.floor((e.clientY - rect.top) / (pixelSize * 8));

    if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT) {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      if (!newTiles[y]) newTiles[y] = Array(SCREEN_WIDTH).fill("");

      if (isErasing) {
        newTiles[y][x] = "";
      } else if (isTitle) {
        // Title screen: just color fill
        newTiles[y][x] = "title";
      } else if (selectedBlock) {
        const [w, h] = selectedBlock.sprite.size.split("x").map(Number);
        const tilesWide = Math.ceil(w / 8);
        const tilesHigh = Math.ceil(h / 8);

        for (let dy = 0; dy < tilesHigh && y + dy < SCREEN_HEIGHT; dy++) {
          for (let dx = 0; dx < tilesWide && x + dx < SCREEN_WIDTH; dx++) {
            if (!newTiles[y + dy]) newTiles[y + dy] = Array(SCREEN_WIDTH).fill("");
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) handleCanvasClick(e);
  };
  const handleMouseUp = () => setIsDrawing(false);

  const handleAddScreen = () => {
    if (!screenName || !screenType) return;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: screenName,
      type: screenType,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")),
    };
    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setScreenName("");
    setScreenType("");
    toast.success("Screen added!");
  };

  const handleDeleteScreen = (id: string) => {
    const updated = screens.filter(s => s.id !== id);
    onScreensChange(updated);
    if (selectedScreen?.id === id) setSelectedScreen(updated[0] || null);
    toast.success("Screen deleted");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas Panel */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-primary">{selectedScreen?.name || "Screen Designer"}</h2>
          {selectedScreen && (
            <span className="px-2 py-1 text-xs bg-primary text-white rounded">
              {selectedScreen.type.toUpperCase()}
            </span>
          )}
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

        {/* Color Palette for Title Screens */}
        {selectedScreen?.type === "title" && (
          <div className="mt-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Screen Name & Type */}
        <Card className="p-4 space-y-2">
          <Input
            placeholder="Screen Name"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
          />
          <Select value={screenType} onValueChange={setScreenType}>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue placeholder="Screen Type" />
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
            className="w-full mt-2"
            onClick={handleAddScreen}
            disabled={!screenName || !screenType}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Screen
          </Button>
        </Card>

        {/* Screen List */}
        <Card className="p-4 space-y-2">
          {screens.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                selectedScreen?.id === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedScreen(s)}
            >
              <span className="text-sm truncate flex-1">{s.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteScreen(s.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </Card>

        {/* Block Palette */}
        {selectedScreen?.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map((b) => (
                  <button
                    key={b.id}
                    className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${
                      selectedBlock?.id === b.id && !isErasing ? "border-primary retro-glow" : "border-border"
                    }`}
                    onClick={() => { setSelectedBlock(b); setIsErasing(false); }}
                    title={b.name}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-xs font-bold">{b.name[0]}</div>
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
