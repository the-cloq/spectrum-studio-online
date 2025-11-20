 import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { SPECTRUM_COLORS, type SpectrumColor, type Screen, type Block } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<Screen["type"] | "">("");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Grid size based on screen type
  const getGrid = () => {
    if (!selectedScreen) return { cols: 0, rows: 0, blockSize: 0 };
    if (selectedScreen.type === "title") return { cols: 256, rows: 192, blockSize: 2 };
    return { cols: 32, rows: 24, blockSize: 16 }; // 8x8 blocks scaled x2
  };

  // Draw the canvas
  useEffect(() => {
    drawScreen();
  }, [selectedScreen, selectedBlock, selectedColor, isErasing]);

  const drawScreen = () => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, blockSize } = getGrid();

    canvas.width = 512;
    canvas.height = 384;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += blockSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += blockSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (selectedScreen.type === "title") {
      // Draw pixels from selectedScreen.pixels
      selectedScreen.pixels?.forEach((row, y) => {
        row.forEach((color, x) => {
          ctx.fillStyle = color?.value || "#000";
          ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
        });
      });
    } else {
      // Draw blocks
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const blockId = selectedScreen.tiles[y]?.[x];
          if (!blockId) continue;
          const block = blocks.find(b => b.id === blockId);
          if (!block?.sprite) continue;

          const sprite = block.sprite;
          const [w, h] = sprite.size.split("x").map(Number);
          const pixelScale = blockSize / 8;
          sprite.pixels.forEach((row, py) => {
            row.forEach((colorIndex, px) => {
              if (colorIndex === 0) return;
              const spectrumColors = [
                "#000000", "#0000D7", "#D70000", "#D700D7",
                "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
                "#000000", "#0000FF", "#FF0000", "#FF00FF",
                "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
              ];
              ctx.fillStyle = spectrumColors[colorIndex] || "#000";
              ctx.fillRect(
                x * blockSize + px * pixelScale,
                y * blockSize + py * pixelScale,
                pixelScale,
                pixelScale
              );
            });
          });
        }
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { blockSize } = getGrid();
    const x = Math.floor((e.clientX - rect.left) / blockSize);
    const y = Math.floor((e.clientY - rect.top) / blockSize);

    if (selectedScreen.type === "title") {
      // Modify pixels
      const newPixels = selectedScreen.pixels?.map(row => [...row]) || [];
      if (!newPixels[y]) newPixels[y] = [];
      newPixels[y][x] = isErasing ? { name: "Black", value: "#000000" } : selectedColor;

      const updatedScreen = { ...selectedScreen, pixels: newPixels };
      updateScreen(updatedScreen);
    } else {
      // Modify tiles
      if (!selectedBlock) return;
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      newTiles[y][x] = isErasing ? "" : selectedBlock.id;
      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      updateScreen(updatedScreen);
    }
  };

  const updateScreen = (updatedScreen: Screen) => {
    onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));
    setSelectedScreen(updatedScreen);
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
    if (!newScreenName || !newScreenType) return;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: newScreenName,
      type: newScreenType as Screen["type"],
      width: 512,
      height: 384,
      tiles: newScreenType === "title" ? [] : Array(24).fill(null).map(() => Array(32).fill("")),
      pixels: newScreenType === "title" ? Array(192).fill(null).map(() => Array(256).fill({ name: "Black", value: "#000000" })) : undefined
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setNewScreenName("");
    setNewScreenType("");
    toast.success("New screen created!");
  };

  const handleDeleteScreen = (screenId: string) => {
    const updatedScreens = screens.filter(s => s.id !== screenId);
    onScreensChange(updatedScreens);
    if (selectedScreen?.id === screenId) setSelectedScreen(updatedScreens[0] || null);
    toast.success("Screen deleted");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas Panel */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && (
              <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
              <Eraser className="w-4 h-4 mr-2" />Erase
            </Button>
          </div>
        </div>
        {selectedScreen && (
          <div className="relative flex justify-center p-4 bg-muted rounded border border-border">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ imageRendering: "pixelated", width: 512, height: 384 }}
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-white rounded text-xs uppercase">{selectedScreen.type}</div>
          </div>
        )}

        {/* Color Palette for Title Screens */}
        {selectedScreen?.type === "title" && (
          <div className="mt-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </div>
        )}
      </Card>

      {/* Right Sidebar */}
      <div className="space-y-4">
        {/* Add Screen Panel */}
        <Card className="p-4 space-y-2">
          <Label>Screen Name</Label>
          <Input value={newScreenName} onChange={e => setNewScreenName(e.target.value)} placeholder="Enter name" />
          <Label>Screen Type</Label>
          <Select value={newScreenType} onValueChange={setNewScreenType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="game">Game</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full mt-2" disabled={!newScreenName || !newScreenType} onClick={handleCreateScreen}>
            <Plus className="w-4 h-4 mr-2" />Add Screen
          </Button>
        </Card>

        {/* Screen List */}
        <Card className="p-4">
          <h3 className="text-sm font-bold text-primary mb-2">Screens</h3>
          <div className="space-y-2 max-h-64 overflow-auto">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedScreen(screen)}
              >
                <span className="truncate">{screen.name}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); handleDeleteScreen(screen.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Block Palette for Game Screens */}
        {selectedScreen?.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-2">Block Palette</h3>
            <div className="grid grid-cols-3 gap-2">
              {blocks.map(block => (
                <button
                  key={block.id}
                  className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${selectedBlock?.id === block.id && !isErasing ? "border-primary retro-glow" : "border-border"}`}
                  onClick={() => { setSelectedBlock(block); setIsErasing(false); }}
                  title={block.name}
                >
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold">{block.name[0]}</div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
