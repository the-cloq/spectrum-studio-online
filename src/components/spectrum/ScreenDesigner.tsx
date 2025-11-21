import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { SPECTRUM_COLORS, type SpectrumColor, type Screen, type Block } from "@/types/spectrum";
import { Plus, Trash2, Eraser, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

import LoadingScreenImporter from "@/components/spectrum/LoadingScreenImporter";

<LoadingScreenImporter
  onImport={(imageData) => {
    // This is where we feed the cropped + converted artwork
    // into your loading screen system
    console.log("Imported ZX Image:", imageData);
  }}
/>

interface ScreenDesignerProps {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

const BASE_WIDTH = 256;
const BASE_HEIGHT = 192;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export const ScreenDesigner = ({ blocks, screens, onScreensChange }: ScreenDesignerProps) => {

  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<Screen["type"] | "">("");
  const [zoom, setZoom] = useState(2); // DEFAULT = 512x384

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canvasWidth = BASE_WIDTH * zoom;
  const canvasHeight = BASE_HEIGHT * zoom;

  const getGrid = () => {
    if (!selectedScreen) return { cols: 0, rows: 0, blockSize: 0 };

    // TITLE SCREEN → 256x192 pixels
    if (selectedScreen.type === "title") {
      return {
        cols: 256,
        rows: 192,
        blockSize: zoom * 1 // 1 ZX pixel scaled by zoom
      };
    }

    // GAME SCREEN → 32x24 blocks
    return {
      cols: 32,
      rows: 24,
      blockSize: zoom * 8 // 8 ZX pixels per tile * zoom → 16px at zoom=2
    };
  };

  useEffect(() => {
    drawScreen();
  }, [selectedScreen, selectedBlock, selectedColor, isErasing, zoom]);

  const drawScreen = () => {
    if (!selectedScreen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, blockSize } = getGrid();

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.imageSmoothingEnabled = false;

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
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

    // TITLE SCREEN
    if (selectedScreen.type === "title") {
      selectedScreen.pixels?.forEach((row, y) => {
        row.forEach((color, x) => {
          if (!color) return;
          ctx.fillStyle = color.value;
          ctx.fillRect(
            x * blockSize,
            y * blockSize,
            blockSize,
            blockSize
          );
        });
      });
    }

    // GAME SCREEN
    else {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {

          const blockId = selectedScreen.tiles[y]?.[x];
          if (!blockId) continue;

          const block = blocks.find(b => b.id === blockId);
          if (!block?.sprite) continue;

          const sprite = block.sprite;
          const pixelScale = blockSize / 8;

          sprite.pixels.forEach((row, py) => {
            row.forEach((colorIndex, px) => {
              if (!colorIndex) return;

              const col = SPECTRUM_COLORS[colorIndex]?.value || "#000";
              ctx.fillStyle = col;
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
      const newPixels = selectedScreen.pixels?.map(row => [...row]) || [];
      newPixels[y][x] = isErasing
        ? SPECTRUM_COLORS[0] // Black
        : selectedColor;

      updateScreen({ ...selectedScreen, pixels: newPixels });
    } else {
      if (!selectedBlock) return;

      const newTiles = selectedScreen.tiles.map(row => [...row]);
      newTiles[y][x] = isErasing ? "" : selectedBlock.id;

      updateScreen({ ...selectedScreen, tiles: newTiles });
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
      tiles: newScreenType === "title"
        ? undefined
        : Array(24).fill(null).map(() => Array(32).fill("")),
      pixels: newScreenType === "title"
        ? Array(192).fill(null).map(() =>
            Array(256).fill(SPECTRUM_COLORS[0]) // Black
          )
        : undefined
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setNewScreenName("");
    setNewScreenType("");

    toast.success("New screen created!");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

      {/* MAIN */}
      <div className="lg:col-span-3 space-y-4">

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Screen Designer</h2>

            <div className="flex items-center gap-2">

              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 1))}>
                <ZoomOut className="w-4 h-4" />
              </Button>

              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 1))}>
                <ZoomIn className="w-4 h-4" />
              </Button>

              <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
                <Eraser className="w-4 h-4 mr-2" />Erase
              </Button>
            </div>
          </div>

          <div className="flex justify-center p-4 bg-muted rounded border">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                imageRendering: "pixelated",
                width: canvasWidth,
                height: canvasHeight
              }}
            />
          </div>
        </Card>

        {/* TITLE PALETTE */}
        {selectedScreen?.type === "title" && (
          <Card className="p-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </Card>
        )}

        { /* BLOCK PALETTE */ } 
          {selectedScreen?.type === "game" && (
            <Card className="p-4">
              <h3 className="text-sm font-bold mb-2">Blocks</h3>
          
              <div className="grid grid-cols-8 md:grid-cols-12 xl:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                {blocks.map(block => {
          
                  // Generate preview canvas if not available
                  if (!block.sprite?.preview && block.sprite?.pixels) {
                    const canvas = document.createElement("canvas");
                    const size = 32;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d");
          
                    if (ctx) {
                      const pixelSize = size / block.sprite.pixels.length;
                      block.sprite.pixels.forEach((row, y) => {
                        row.forEach((colorIndex, x) => {
                          if (colorIndex) {
                            ctx.fillStyle = SPECTRUM_COLORS[colorIndex]?.value || "#000";
                            ctx.fillRect(
                              x * pixelSize,
                              y * pixelSize,
                              pixelSize,
                              pixelSize
                            );
                          }
                        });
                      });
          
                      block.sprite.preview = canvas.toDataURL();
                    }
                  }
          
                  return (
                    <button
                      key={block.id}
                      className={`aspect-square border rounded p-0.5 hover:border-primary
                        ${selectedBlock?.id === block.id && !isErasing
                          ? "border-primary retro-glow"
                          : "border-border"}`}
                      onClick={() => { 
                        setSelectedBlock(block); 
                        setIsErasing(false); 
                      }}
                    >
                      {block.sprite?.preview ? (
                        <img
                          src={block.sprite.preview}
                          alt={block.name}
                          className="pixelated w-full h-full"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
      </div>

         {/* RIGHT SIDEBAR */}
      <div className="space-y-4">

        <Card className="p-4 space-y-2">
          <Label>Screen Name</Label>
          <Input value={newScreenName} onChange={e => setNewScreenName(e.target.value)} placeholder="Enter name" />

          <Label>Screen Type</Label>
          <Select value={newScreenType} onValueChange={(value) => setNewScreenType(value as "title" | "game" | "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="game">Game</SelectItem>
            </SelectContent>
          </Select>

          <Button
            className="w-full mt-2"
            disabled={!newScreenName || !newScreenType}
            onClick={handleCreateScreen}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Screen
          </Button>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold text-primary mb-2">Screens</h3>
          <div className="space-y-2 max-h-64 overflow-auto">
            {screens.map(screen => (
              <div
                key={screen.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all
                  ${selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                onClick={() => setSelectedScreen(screen)}
              >
                <span className="truncate">{screen.name}</span>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScreensChange(screens.filter(s => s.id !== screen.id));
                    if (selectedScreen?.id === screen.id) {
                      setSelectedScreen(screens.find(s => s.id !== screen.id) || null);
                    }
                  }}
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
