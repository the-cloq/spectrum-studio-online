import { useEffect, useRef, useState } from "react";
import { Plus, Eraser, Trash2 } from "lucide-react";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { BlockPalette } from "@/components/spectrum/BlockPalette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { SPECTRUM_COLORS, type SpectrumColor } from "@/types/spectrum";

type ScreenType = "title" | "game" | "level" | "controls" | "gameover";

interface Screen {
  id: string;
  name: string;
  type: ScreenType;
  data: Uint8ClampedArray;
}

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 384;

export default function ScreenDesigner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [screens, setScreens] = useState<Screen[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);

  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState<ScreenType | "">("");

  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(
    SPECTRUM_COLORS[0]
  );

  const activeScreen = screens.find(s => s.id === activeScreenId);

  /* ---------------- BLOCK SIZE RULES ---------------- */

  const blockSize =
    activeScreen?.type === "title"
      ? 4   // 2x2 logical, doubled to 4x4
      : 16; // 8x8 logical, doubled to 16x16

  const logicalBlock =
    activeScreen?.type === "title"
      ? 2
      : 8;


  // Converts a sprite array into an image URL for previews
const renderSpritePreview = (sprite: number[][]) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  const width = sprite[0]?.length ?? 0;
  const height = sprite.length;

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const value = sprite[y][x]; // assuming 0 or 1

      const color = value ? 255 : 0;

      imageData.data[index] = color;     // R
      imageData.data[index + 1] = color; // G
      imageData.data[index + 2] = color; // B
      imageData.data[index + 3] = 255;   // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
};

  /* ---------------- CREATE SCREEN ---------------- */

  const addScreen = () => {
    if (!screenName || !screenType) return;

    const id = crypto.randomUUID();

    const blank = new Uint8ClampedArray(
      CANVAS_WIDTH * CANVAS_HEIGHT * 4
    );

    const newScreen: Screen = {
      id,
      name: screenName,
      type: screenType as ScreenType,
      data: blank,
    };

    setScreens(prev => [...prev, newScreen]);
    setActiveScreenId(id);

    setScreenName("");
    setScreenType("");
  };

  const deleteScreen = (id: string) => {
    setScreens(prev => prev.filter(s => s.id !== id));
    if (id === activeScreenId) {
      setActiveScreenId(null);
    }
  };

  /* ---------------- DRAW ---------------- */

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeScreen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = new ImageData(
      activeScreen.data,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );

    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    drawScreen();
  }, [activeScreen]);

  /* ---------------- PAINT ---------------- */

  const paintPixel = (x: number, y: number) => {
    if (!activeScreen) return;

    const updated = new Uint8ClampedArray(activeScreen.data);

    for (let py = 0; py < logicalBlock; py++) {
      for (let px = 0; px < logicalBlock; px++) {
        const index =
          ((y + py) * CANVAS_WIDTH + (x + px)) * 4;

        updated[index] = selectedColor.rgb[0];
        updated[index + 1] = selectedColor.rgb[1];
        updated[index + 2] = selectedColor.rgb[2];
        updated[index + 3] = 255;
      }
    }

    setScreens(prev =>
      prev.map(screen =>
        screen.id === activeScreenId
          ? { ...screen, data: updated }
          : screen
      )
    );
  };

  /* ---------------- HANDLE CANVAS CLICK ---------------- */

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeScreen) return;

    const rect = canvas.getBoundingClientRect();

    const x = Math.floor(
      (e.clientX - rect.left) / blockSize
    ) * logicalBlock;

    const y = Math.floor(
      (e.clientY - rect.top) / blockSize
    ) * logicalBlock;

    paintPixel(x, y);
  };

  /* ---------------- CLEAR SCREEN ---------------- */

  const clearScreen = () => {
    if (!activeScreen) return;

    const cleared = new Uint8ClampedArray(
      CANVAS_WIDTH * CANVAS_HEIGHT * 4
    );

    setScreens(prev =>
      prev.map(screen =>
        screen.id === activeScreenId
          ? { ...screen, data: cleared }
          : screen
      )
    );
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="flex gap-6 p-4">

      {/* LEFT SIDE */}
      <div className="flex-1 space-y-4">

        {/* CANVAS PANEL */}
        <div className="border border-border p-4 rounded relative">

          <div className="absolute top-2 left-2 px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground">
            {activeScreen?.type?.toUpperCase() || "NO SCREEN"}
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="border border-border bg-black cursor-crosshair"
            style={{
              imageRendering: "pixelated",
              width: "512px",
              height: "384px",
            }}
          />

          {/* Tools */}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">
              <Eraser size={14} />
            </Button>

            <Button
              onClick={clearScreen}
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* PALETTES UNDER CANVAS */}
        {activeScreen?.type === "title" && (
          <ColorPalette
            selectedColor={selectedColor}
            onColorSelect={setSelectedColor}
          />
        )}

        {activeScreen?.type === "game" && (
          <BlockPalette size="xs" />
        )}

      </div>

      {/* RIGHT PANEL */}
      <div className="w-80 space-y-4 border-l border-border pl-4">

        <h3 className="font-bold text-sm">New Screen</h3>

        <Input
          placeholder="Screen name"
          value={screenName}
          onChange={e => setScreenName(e.target.value)}
        />

        <Select
          value={screenType}
          onValueChange={v => setScreenType(v as ScreenType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select screen type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="game">Game</SelectItem>
            <SelectItem value="level">Level</SelectItem>
            <SelectItem value="controls">Controls</SelectItem>
            <SelectItem value="gameover">Game Over</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={addScreen}
          disabled={!screenName || !screenType}
        >
          <Plus size={14} /> Add Screen
        </Button>

        {/* SCREEN LIST */}
        <div className="space-y-2 mt-4">
          {screens.map(screen => (
            <div
              key={screen.id}
              className={cn(
                "flex items-center justify-between p-2 border rounded cursor-pointer",
                screen.id === activeScreenId && "border-primary"
              )}
              onClick={() => setActiveScreenId(screen.id)}
            >
              <div>
                <p className="text-sm font-medium">
                  {screen.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {screen.type}
                </p>
              </div>

              <Trash2
                size={14}
                className="cursor-pointer text-muted-foreground hover:text-red-500"
                onClick={e => {
                  e.stopPropagation();
                  deleteScreen(screen.id);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
