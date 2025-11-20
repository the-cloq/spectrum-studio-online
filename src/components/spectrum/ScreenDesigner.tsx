import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Screen, type Block, type SpectrumColor } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { SPECTRUM_COLORS } from "@/types/spectrum";

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

// Base Spectrum resolution
const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState<Screen["type"] | "">("");
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[0]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Determine pixel size based on type
  const getPixelSize = (type: string) => (type === "title" ? 2 : 8);

  useEffect(() => {
    if (selectedScreen) drawScreen();
  }, [selectedScreen, blocks, selectedColor]);

  const drawScreen = () => {
    if (!selectedScreen || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const pixelSize = getPixelSize(selectedScreen.type);

    // Canvas dimensions
    const canvasWidth = SCREEN_WIDTH * 8 * pixelSize;
    const canvasHeight = SCREEN_HEIGHT * 8 * pixelSize;
    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;

    // Scale for crisp pixels
    canvasRef.current.style.width = `${canvasWidth}px`;
    canvasRef.current.style.height = `${canvasHeight}px`;

    // Fill background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    ctx.strokeStyle = "rgba(100,100,100,0.2)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= SCREEN_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * 8 * pixelSize, 0);
      ctx.lineTo(x * 8 * pixelSize, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= SCREEN_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * 8 * pixelSize);
      ctx.lineTo(canvasWidth, y * 8 * pixelSize);
      ctx.stroke();
    }

    // Draw blocks if type != title
    if (selectedScreen.type !== "title") {
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const blockId = selectedScreen.tiles[y]?.[x];
          if (blockId) {
            const block = blocks.find(b => b.id === blockId);
            if (block?.sprite) drawBlockOnCanvas(ctx, block, x, y, pixelSize);
          }
        }
      }
    } else {
      // For title, fill all pixels based on "titlePixels" 2x2 blocks
      const titlePixels = selectedScreen.titlePixels || Array(SCREEN_HEIGHT * 8).fill(Array(SCREEN_WIDTH * 8).fill(0));
      titlePixels.forEach((row, py) => {
        row.forEach((colorIndex, px) => {
          if (colorIndex > 0 && colorIndex <= 15) {
            ctx.fillStyle = SPECTRUM_COLORS[colorIndex].value;
            ctx.fillRect(px * pixelSize, py * pixelSize, pixelSize, pixelSize);
          }
        });
      });
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, pixelSize: number) => {
    const sprite = block.sprite;
    const [width, height] = sprite.size.split("x").map(Number);

    sprite.pixels.forEach((row, py) => {
      row.forEach((colorIndex, px) => {
        if (colorIndex !== 0) {
          const color = SPECTRUM_COLORS[colorIndex]?.value || "#000";
          ctx.fillStyle = color;
          ctx.fillRect(
            x * 8 * pixelSize + px * pixelSize,
            y * 8 * pixelSize + py * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const pixelSize = getPixelSize(selectedScreen.type);

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridX = Math.floor(mouseX / pixelSize);
    const gridY = Math.floor(mouseY / pixelSize);

    if (selectedScreen.type === "title") {
      // Draw title screen pixels
      const titlePixels = selectedScreen.titlePixels?.map(r => [...r]) || Array(SCREEN_HEIGHT * 8).fill(Array(SCREEN_WIDTH * 8).fill(0));
      if (!titlePixels[gridY]) titlePixels[gridY] = Array(SCREEN_WIDTH * 8).fill(0);

      titlePixels[gridY][gridX] = isErasing ? 0 : SPECTRUM_COLORS.indexOf(selectedColor);

      const updatedScreen = { ...selectedScreen, titlePixels };
      setSelectedScreen(updatedScreen);
      onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));
    } else {
      // Regular block drawing
      const tileX = Math.floor(gridX / 8);
      const tileY = Math.floor(gridY / 8);

      const newTiles = selectedScreen.tiles.map(r => [...r]);
      if (!newTiles[tileY]) newTiles[tileY] = Array(SCREEN_WIDTH).fill("");

      if (isErasing) newTiles[tileY][tileX] = "";
      else if (selectedBlock) newTiles[tileY][tileX] = selectedBlock.id;

      const updatedScreen = { ...selectedScreen, tiles: newTiles };
      setSelectedScreen(updatedScreen);
      onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));
    }

    drawScreen();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { setIsDrawing(true); handleCanvasClick(e); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (isDrawing) handleCanvasClick(e); };
  const handleMouseUp = () => setIsDrawing(false);

  const handleCreateScreen = () => {
    if (!screenName.trim() || !screenType) return;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: screenName,
      type: screenType as Screen["type"],
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      tiles: Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill("")),
      titlePixels: screenType === "title" ? Array(SCREEN_HEIGHT * 8).fill(Array(SCREEN_WIDTH * 8).fill(0)) : undefined
    };
    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setScreenName("");
    setScreenType("");
    toast.success("Screen created!");
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Screen Designer</h2>
            {selectedScreen && (
              <div className="flex gap-2 items-center">
                <p className="text-sm text-muted-foreground">{selectedScreen.name}</p>
                <span className="px-2 py-1 bg-primary text-white text-xs rounded">{selectedScreen.type}</span>
              </div>
            )}
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

        {/* Color Palette for title */}
        {selectedScreen?.type === "title" && (
          <div className="mt-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Screen Inputs */}
        <Card className="p-4 space-y-2">
          <Input placeholder="Screen Name" value={screenName} onChange={e => setScreenName(e.target.value)} />
          <Select onValueChange={v => setScreenType(v as Screen["type"])} value={screenType}>
            <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select Screen Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title Screen</SelectItem>
              <SelectItem value="game">Game Screen</SelectItem>
              <SelectItem value="level">Level Screen</SelectItem>
              <SelectItem value="gameover">Game Over</SelectItem>
              <SelectItem value="controls">Controls</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full mt-2" onClick={handleCreateScreen} disabled={!screenName || !screenType}>
            <Plus className="w-4 h-4 mr-2" /> Add Screen
          </Button>
        </Card>

        {/* Screen List */}
        <Card className="p-4 space-y-2">
          {screens.map(screen => (
            <div key={screen.id} className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
              onClick={() => setSelectedScreen(screen)}
            >
              <span className="truncate flex-1">{screen.name}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); handleDeleteScreen(screen.id); }}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </Card>

        {/* Block Palette for non-title screens */}
        {selectedScreen?.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Create blocks first</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {blocks.map(block => (
                  <button key={block.id} className={`aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary ${selectedBlock?.id === block.id && !isErasing ? "border-primary retro-glow" : "border-border"}`}
                    onClick={() => { setSelectedBlock(block); setIsErasing(false); }}
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
      </div>
    </div>
  );
};
