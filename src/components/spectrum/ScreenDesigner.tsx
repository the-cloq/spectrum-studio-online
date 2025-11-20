import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Screen, type Block, type ScreenType } from "@/types/spectrum";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Grid3x3, Eraser } from "lucide-react";
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

  // Sync selectedScreen
  useEffect(() => {
    if (!selectedScreen && screens.length > 0) {
      setSelectedScreen(screens[0]);
      return;
    }
    if (selectedScreen) {
      const found = screens.find(s => s.id === selectedScreen.id);
      if (found) {
        setSelectedScreen(found);
      } else {
        setSelectedScreen(screens[0] || null);
      }
    }
  }, [screens]);

  useEffect(() => {
    drawScreen();
  }, [selectedScreen, blocks]);

  const drawScreen = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || !selectedScreen) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = SCREEN_WIDTH * TILE_SIZE;
      canvas.height = SCREEN_HEIGHT * TILE_SIZE;

      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = "rgba(100, 100, 100, 0.15)";
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
          const row = selectedScreen.tiles?.[y];
          if (!row) continue;
          const blockId = row[x];
          if (!blockId) continue;

          const block = blocks.find(b => b.id === blockId);
          if (block?.sprite) {
            drawBlockOnCanvas(ctx, block, x * TILE_SIZE, y * TILE_SIZE);
          }
        }
      }
    } catch (err) {
      console.error("drawScreen error", err);
      toast.error("Error drawing screen (see console)");
    }
  };

  const drawBlockOnCanvas = (ctx: CanvasRenderingContext2D, block: Block, x: number, y: number) => {
    const sprite = block.sprite;
    if (!sprite || !sprite.size || !sprite.pixels) return;

    const baseSize = 8;
    const pixelScale = TILE_SIZE / baseSize;

    const spectrumColors = [
      "#000000", "#0000D7", "#D70000", "#D700D7",
      "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
      "#000000", "#0000FF", "#FF0000", "#FF00FF",
      "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
    ];

    for (let py = 0; py < sprite.pixels.length; py++) {
      const row = sprite.pixels[py];
      if (!row) continue;
      for (let px = 0; px < row.length; px++) {
        const colorIndex = row[px];
        if (!colorIndex) continue;

        ctx.fillStyle = spectrumColors[colorIndex] || "#FFF";
        ctx.fillRect(
          Math.round(x + px * pixelScale),
          Math.round(y + py * pixelScale),
          Math.max(1, Math.round(pixelScale)),
          Math.max(1, Math.round(pixelScale))
        );
      }
    }
  };

  // 🔥 NEW: Save a thumbnail whenever changes happen
  const updateThumbnail = () => {
    if (!canvasRef.current || !selectedScreen) return;

    const dataUrl = canvasRef.current.toDataURL("image/png");

    const updatedScreens = screens.map(s =>
      s.id === selectedScreen.id
        ? { ...s, thumbnail: dataUrl }
        : s
    );

    onScreensChange(updatedScreens);
  };

  // Auto-update thumbnail after drawing stops
  useEffect(() => {
    if (!selectedScreen) return;

    const timeout = setTimeout(() => {
      updateThumbnail();
    }, 300); // debounce

    return () => clearTimeout(timeout);
  }, [selectedScreen?.tiles]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;

    const newTiles = selectedScreen.tiles.map(row => [...row]);

    if (isErasing) {
      newTiles[y][x] = "";
    } else if (selectedBlock) {
      newTiles[y][x] = selectedBlock.id;
    }

    const updatedScreen = { ...selectedScreen, tiles: newTiles };
    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? updatedScreen : s);

    onScreensChange(updatedScreens);
    setSelectedScreen(updatedScreen);
  };

  const handleCreateScreen = () => {
    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: `Screen ${screens.length + 1}`,
      type: "level",
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      tiles: Array.from({ length: SCREEN_HEIGHT }, () => Array(SCREEN_WIDTH).fill("")),
      thumbnail: undefined,
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
  };

  const handleScreenTypeChange = (screenId: string, newType: ScreenType) => {
    const updatedScreens = screens.map(screen =>
      screen.id === screenId ? { ...screen, type: newType } : screen
    );
    onScreensChange(updatedScreens);
  };

  const handleDeleteScreen = (screenId: string) => {
    const updatedScreens = screens.filter(s => s.id !== screenId);
    onScreensChange(updatedScreens);
    setSelectedScreen(updatedScreens[0] || null);
  };

  const handleClearScreen = () => {
    if (!selectedScreen) return;

    const clearedScreen = {
      ...selectedScreen,
      tiles: Array.from({ length: SCREEN_HEIGHT }, () => Array(SCREEN_WIDTH).fill("")),
    };

    const updatedScreens = screens.map(s => s.id === selectedScreen.id ? clearedScreen : s);
    onScreensChange(updatedScreens);
    setSelectedScreen(clearedScreen);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main canvas */}
      <Card className="p-4 lg:col-span-3">
        <h2 className="text-lg font-bold mb-3">Screen Designer</h2>

        {selectedScreen && (
          <div className="flex gap-3 mb-4">
            <Input
              value={selectedScreen.name}
              onChange={(e) => {
                const updated = screens.map(s =>
                  s.id === selectedScreen.id ? { ...s, name: e.target.value } : s
                );
                onScreensChange(updated);
              }}
            />

            <Select
              value={selectedScreen.type}
              onValueChange={(v: ScreenType) => handleScreenTypeChange(selectedScreen.id, v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="game">Game</SelectItem>
                <SelectItem value="level">Level</SelectItem>
                <SelectItem value="gameover">Game Over</SelectItem>
                <SelectItem value="controls">Controls</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="border bg-black w-full"
          onMouseDown={(e) => {
            setIsDrawing(true);
            handleCanvasClick(e);
          }}
          onMouseMove={(e) => isDrawing && handleCanvasClick(e)}
          onMouseUp={() => setIsDrawing(false)}
          onMouseLeave={() => setIsDrawing(false)}
          style={{ imageRendering: "pixelated" }}
        />
      </Card>
    </div>
  );
};
