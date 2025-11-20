import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { type Screen, type Block, type SpectrumColor } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

// Unified canvas size
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 384;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor | null>(null);
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState<Screen["type"]>("game");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getGridSize = () => {
    if (selectedScreen?.type === "title") return { cols: 256, rows: 192, pixelSize: 2 };
    return { cols: 64, rows: 48, pixelSize: 8 };
  };

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedScreen) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, pixelSize } = getGridSize();

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw tiles or pixels
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const blockId = selectedScreen.tiles[y]?.[x];
        if (blockId && selectedScreen.type !== "title") {
          const block = blocks.find(b => b.id === blockId);
          if (block?.sprite) drawBlockOnCanvas(ctx, block, x * pixelSize, y * pixelSize, pixelSize);
        } else if (selectedScreen.type === "title" && selectedScreen.pixels) {
          const color = selectedScreen.pixels[y]?.[x];
          if (color) {
            ctx.fillStyle = color.value;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    }

    // Draw grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * pixelSize, 0);
      ctx.lineTo(x * pixelSize, rows * pixelSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * pixelSize);
      ctx.lineTo(cols * pixelSize, y * pixelSize);
      ctx.stroke();
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, pixelSize: number) => {
    const sprite = block.sprite;
    sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex > 0) {
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

    const rect = canvas.getBoundingClientRect();
    const { cols, rows, pixelSize } = getGridSize();
    const x = Math.floor((e.clientX - rect.left) / pixelSize);
    const y = Math.floor((e.clientY - rect.top) / pixelSize);

    if (x < 0 || y < 0 || x >= cols || y >= rows) return;

    if (selectedScreen.type === "title") {
      if (!selectedScreen.pixels) selectedScreen.pixels = Array(rows).fill(null).map(() => Array(cols).fill(null));
      const newPixels = selectedScreen.pixels.map(row => [...row]);
      newPixels[y][x] = selectedColor || { name: "White", value: "#FFFFFF", ink: 7, bright: true };
      const updatedScreen = { ...selectedScreen, pixels: newPixels };
      updateScreen(updatedScreen);
    } else if (selectedBlock && !isErasing) {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      newTiles[y][x] = selectedBlock.id;
      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      updateScreen(updatedScreen);
    } else if (isErasing && selectedScreen.tiles) {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      newTiles[y][x] = "";
      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      updateScreen(updatedScreen);
    }
  };

  const updateScreen = (screen: Screen) => {
    const updatedScreens = screens.map(s => s.id === screen.id ? screen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(screen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) handleCanvasClick(e);
  };

  const handleMouseUp = () => setIsDrawing(false);

  const handleCreateScreen = () => {
    if (!screenName.trim() || !screenType) return;

    const cols = screenType === "title" ? 256 : 64;
    const rows = screenType === "title" ? 192 : 48;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: screenName,
      type: screenType,
      width: cols,
      height: rows,
      tiles: Array(rows).fill(null).map(() => Array(cols).fill("")),
      pixels: screenType === "title" ? Array(rows).fill(null).map(() => Array(cols).fill(null)) : undefined,
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setScreenName("");
    setScreenType("game");
    toast.success("Screen created!");
  };

  const handleDeleteScreen = (id: string) => {
    const updatedScreens = screens.filter(s => s.id !== id);
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === id) setSelectedScreen(updatedScreens[0] || null);
    toast.success("Screen deleted");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas Panel */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
          {selectedScreen && (
            <span className="px-2 py-1 bg-primary text-white text-xs rounded">
              {selectedScreen.type.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex justify-center p-4 bg-muted rounded border border-border overflow-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ imageRendering: "pixelated", width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            className="cursor-crosshair"
          />
        </div>

        {/* Color palette only for title screens */}
        {selectedScreen?.type === "title" && selectedColor && (
          <div className="mt-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </div>
        )}

        {/* Block palette only for non-title screens */}
        {selectedScreen?.type !== "title" && (
          <Card className="mt-4 p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Create blocks first
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map(block => (
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
                      <div className="text-xs font-bold">{block.name.substring(0,1)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Screen Name & Type */}
        <Card className="p-4 space-y-2">
          <Input
            placeholder="Screen Name"
            value={screenName}
            onChange={e => setScreenName(e.target.value)}
          />
          <Select onValueChange={value => setScreenType(value as Screen["type"])}>
            <SelectTrigger className="w-full">
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
            disabled={!screenName.trim() || !screenType}
            onClick={handleCreateScreen}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Screen
          </Button>
        </Card>

        {/* Screen List */}
        <Card className="p-4 space-y-2">
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
        </Card>
      </div>
    </div>
  );
};
