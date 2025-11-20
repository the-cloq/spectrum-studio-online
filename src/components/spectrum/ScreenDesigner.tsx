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

// Title/Loading screen pixel grid
const TITLE_WIDTH = 128; // 256 / 2
const TITLE_HEIGHT = 96; // 192 / 2
const TITLE_SCALE = 4; // scale up for display

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>({
    ink: 7,
    bright: false,
    name: "White",
    value: "#D7D7D7"
  });
  const [screenType, setScreenType] = useState<string>(selectedScreen?.type || "game");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor, screenType]);

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedScreen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (screenType === "title") {
      canvas.width = TITLE_WIDTH;
      canvas.height = TITLE_HEIGHT;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw 2x2 pixels
      if (selectedScreen.tiles) {
        for (let y = 0; y < TITLE_HEIGHT; y++) {
          for (let x = 0; x < TITLE_WIDTH; x++) {
            const color = selectedScreen.tiles[y]?.[x];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    } else {
      canvas.width = SCREEN_WIDTH * TILE_SIZE;
      canvas.height = SCREEN_HEIGHT * TILE_SIZE;

      // Draw background
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
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

      // Draw tiles
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const blockId = selectedScreen.tiles[y]?.[x];
          if (blockId) {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlockOnCanvas(ctx, block, x * TILE_SIZE, y * TILE_SIZE);
          }
        }
      }
    }
  };

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
    const x = Math.floor((e.clientX - rect.left) / (screenType === "title" ? TITLE_SCALE : TILE_SIZE));
    const y = Math.floor((e.clientY - rect.top) / (screenType === "title" ? TITLE_SCALE : TILE_SIZE));

    if (screenType === "title") {
      const newTiles = selectedScreen.tiles.map(row => [...row]);
      newTiles[y][x] = isErasing ? "" : selectedColor.value;

      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
      onScreensChange(updatedScreens);
      setSelectedScreen(updatedScreen);
    } else {
      if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT) {
        const newTiles = selectedScreen.tiles.map(row => [...row]);
        if (isErasing) newTiles[y][x] = "";
        else if (selectedBlock) {
          const [spriteWidth, spriteHeight] = selectedBlock.sprite.size.split("x").map(Number);
          const tilesWide = Math.ceil(spriteWidth / 8);
          const tilesHigh = Math.ceil(spriteHeight / 8);
          for (let dy = 0; dy < tilesHigh && (y + dy) < SCREEN_HEIGHT; dy++) {
            for (let dx = 0; dx < tilesWide && (x + dx) < SCREEN_WIDTH; dx++) {
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
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
  const handleMouseUp = () => setIsDrawing(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedScreen || !e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = TITLE_WIDTH;
        canvas.height = TITLE_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, TITLE_WIDTH, TITLE_HEIGHT);
        const imgData = ctx.getImageData(0, 0, TITLE_WIDTH, TITLE_HEIGHT);
        const newTiles: string[][] = Array(TITLE_HEIGHT).fill(null).map(() => Array(TITLE_WIDTH).fill(""));

        for (let y = 0; y < TITLE_HEIGHT; y++) {
          for (let x = 0; x < TITLE_WIDTH; x++) {
            const i = (y * TITLE_WIDTH + x) * 4;
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            newTiles[y][x] = `rgb(${r},${g},${b})`;
          }
        }

        const updatedScreen = { ...selectedScreen, tiles: newTiles };
        const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
        onScreensChange(updatedScreens);
        setSelectedScreen(updatedScreen);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    if (!selectedScreen) return;
    const newTiles = Array(TITLE_HEIGHT).fill(null).map(() => Array(TITLE_WIDTH).fill(""));
    const updatedScreen = { ...selectedScreen, tiles: newTiles };
    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(updatedScreen);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={isErasing ? "default" : "outline"}
              onClick={() => setIsErasing(!isErasing)}
            >
              <Eraser className="w-4 h-4 mr-2" />Erase
            </Button>
          </div>
        </div>

        {/* Screen Type Dropdown */}
        <div className="mb-2">
          <Label>Screen Type</Label>
          <Select value={screenType} onValueChange={(value) => { setScreenType(value); if (selectedScreen) setSelectedScreen({ ...selectedScreen, type: value }); }}>
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

        <div className="flex justify-center p-4 bg-muted rounded border border-border overflow-auto">
          <canvas
            ref={canvasRef}
            width={screenType === "title" ? TITLE_WIDTH : SCREEN_WIDTH * TILE_SIZE}
            height={screenType === "title" ? TITLE_HEIGHT : SCREEN_HEIGHT * TILE_SIZE}
            className={`cursor-crosshair ${screenType === "title" ? `w-[512px] h-[384px]` : ""}`}
            style={{ imageRendering: "pixelated" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {screenType === "title" && (
          <div className="mt-4 flex flex-col gap-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
            <div className="flex gap-2">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="border rounded p-1" />
              <Button size="sm" variant="outline" onClick={clearCanvas}>Clear</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sidebar: Screens and Blocks */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-primary">Screens</h3>
            <Button size="sm" variant="outline" onClick={() => {
              const newScreen: Screen = { id: `screen-${Date.now()}`, name: `Screen ${screens.length + 1}`, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")), type: "game" };
              onScreensChange([...screens, newScreen]);
              setSelectedScreen(newScreen);
              toast.success("New screen created!");
            }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {screens.map((screen) => (
              <div key={screen.id} className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`} onClick={() => setSelectedScreen(screen)}>
                <span className="text-sm truncate flex-1">{screen.name}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); const updatedScreens = screens.filter(s => s.id !== screen.id); onScreensChange(updatedScreens); if (selectedScreen?.id === screen.id) setSelectedScreen(updatedScreens[0] || null); toast.success("Screen deleted"); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {screenType !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map((block) => (
                  <button key={block.id} className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${selectedBlock?.id === block.id && !isErasing ? "border-primary retro-glow" : "border-border"}`} onClick={() => { setSelectedBlock(block); setIsErasing(false); }} title={block.name}>
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
