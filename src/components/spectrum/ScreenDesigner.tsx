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

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 384;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState<Screen["type"]>("game");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getGrid = () => {
    if (!selectedScreen) return { cols: 64, rows: 48, blockSize: 8 };
    if (selectedScreen.type === "title") return { cols: 256, rows: 192, blockSize: 2 };
    return { cols: 64, rows: 48, blockSize: 8 };
  };

  useEffect(() => {
    if (selectedScreen) drawCanvas();
  }, [selectedScreen, selectedBlock, selectedColor]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedScreen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const { cols, rows, blockSize } = getGrid();

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (selectedScreen.type === "title" && selectedScreen.pixels) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const color = selectedScreen.pixels[y]?.[x];
          if (color) {
            ctx.fillStyle = color.value;
            ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
          }
        }
      }
    } else if (selectedScreen.tiles) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const blockId = selectedScreen.tiles[y]?.[x];
          if (blockId) {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlock(ctx, block, x * blockSize, y * blockSize, blockSize);
          }
        }
      }
    }

    // Grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * blockSize, 0);
      ctx.lineTo(x * blockSize, rows * blockSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * blockSize);
      ctx.lineTo(cols * blockSize, y * blockSize);
      ctx.stroke();
    }
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, blockSize: number) => {
    block.sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex > 0) {
          const spectrumColors = [
            "#000000", "#0000D7", "#D70000", "#D700D7",
            "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
            "#000000", "#0000FF", "#FF0000", "#FF00FF",
            "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
          ];
          ctx.fillStyle = spectrumColors[colorIndex] || "#000";
          ctx.fillRect(x + px * (blockSize / 8), y + py * (blockSize / 8), blockSize / 8, blockSize / 8);
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { cols, rows, blockSize } = getGrid();
    const x = Math.floor((e.clientX - rect.left) / blockSize);
    const y = Math.floor((e.clientY - rect.top) / blockSize);

    if (x < 0 || x >= cols || y < 0 || y >= rows) return;

    if (selectedScreen.type === "title") {
      if (!selectedScreen.pixels) selectedScreen.pixels = Array(rows).fill(null).map(() => Array(cols).fill(null));
      const newPixels = selectedScreen.pixels.map(row => [...row]);
      newPixels[y][x] = selectedColor!;
      const updated = { ...selectedScreen, pixels: newPixels };
      updateScreen(updated);
    } else {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      if (isErasing) newTiles[y][x] = "";
      else if (selectedBlock) newTiles[y][x] = selectedBlock.id;
      const updated = { ...selectedScreen, tiles: newTiles };
      updateScreen(updated);
    }
  };

  const updateScreen = (screen: Screen) => {
    const updated = screens.map(s => s.id === screen.id ? screen : s);
    onScreensChange(updated);
    setSelectedScreen(screen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
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
      pixels: screenType === "title" ? Array(rows).fill(null).map(() => Array(cols).fill(null)) : undefined
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setScreenName("");
    setScreenType("game");
    toast.success("Screen created!");
  };

  const handleDeleteScreen = (id: string) => {
    const updated = screens.filter(s => s.id !== id);
    onScreensChange(updated);
    if (selectedScreen?.id === id) setSelectedScreen(updated[0] || null);
    toast.success("Screen deleted!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Canvas Panel */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
          {selectedScreen && <span className="px-2 py-1 bg-primary text-white text-xs rounded">{selectedScreen.type.toUpperCase()}</span>}
        </div>
        <div className="flex justify-center p-4 bg-muted rounded border border-border overflow-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
            style={{ imageRendering: "pixelated", width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          />
        </div>

        {selectedScreen?.type === "title" && (
          <div className="mt-4"><ColorPalette selectedColor={selectedColor!} onColorSelect={setSelectedColor} /></div>
        )}

        {selectedScreen?.type !== "title" && (
          <Card className="mt-4 p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            <div className="grid grid-cols-3 gap-2">
              {blocks.map(b => (
                <button
                  key={b.id}
                  className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${selectedBlock?.id === b.id && !isErasing ? "border-primary retro-glow" : "border-border"}`}
                  onClick={() => { setSelectedBlock(b); setIsErasing(false); }}
                >
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold">{b.name[0]}</div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card className="p-4 space-y-2">
          <Input placeholder="Screen Name" value={screenName} onChange={e => setScreenName(e.target.value)} />
          <Select onValueChange={v => setScreenType(v as Screen["type"])}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Screen Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title Screen</SelectItem>
              <SelectItem value="game">Game Screen</SelectItem>
              <SelectItem value="level">Level Screen</SelectItem>
              <SelectItem value="gameover">Game Over</SelectItem>
              <SelectItem value="controls">Controls</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full mt-2" disabled={!screenName.trim() || !screenType} onClick={handleCreateScreen}>
            <Plus className="w-4 h-4 mr-2"/> Add Screen
          </Button>
        </Card>

        <Card className="p-4 space-y-2">
          {screens.map(s => (
            <div key={s.id} className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${selectedScreen?.id === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`} onClick={() => setSelectedScreen(s)}>
              <span className="text-sm truncate flex-1">{s.name}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); handleDeleteScreen(s.id); }}>
                <Trash2 className="w-3 h-3"/>
              </Button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};
