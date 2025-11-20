import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { Eraser, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SPECTRUM_COLORS, type SpectrumColor } from "@/types/spectrum";
import { type Screen, type Block } from "@/types/spectrum";

// ====== CONSTANTS ======

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 384;

// Game screen logic (ZX Spectrum 256x192 doubled)
const LOGICAL_GAME_WIDTH = 32;
const LOGICAL_GAME_HEIGHT = 24;

// Title screen logic (pixel-art mode)
const LOGICAL_TITLE_WIDTH = 256;
const LOGICAL_TITLE_HEIGHT = 192;

export const ScreenDesigner = ({
  blocks,
  screens,
  onScreensChange,
}: {
  blocks: Block[];
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(
    screens[0] || null
  );
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(
    SPECTRUM_COLORS[0]
  );
  const [isErasing, setIsErasing] = useState(false);

  useEffect(() => {
    if (selectedScreen) {
      drawScreen();
    }
  }, [selectedScreen]);

  const updateScreen = (updatedScreen: Screen) => {
    const updated = screens.map((s) =>
      s.id === updatedScreen.id ? updatedScreen : s
    );
    onScreensChange(updated);
    setSelectedScreen(updatedScreen);
  };

  // ====== DRAWING ======

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedScreen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (selectedScreen.type === "title") {
      drawTitleScreen(ctx);
    } else {
      drawGameScreen(ctx);
    }
  };

  // ----- TITLE SCREEN (2×2 pixel painting) -----

  const drawTitleScreen = (ctx: CanvasRenderingContext2D) => {
    const pixelSize = 4; // 2x2 logical → scaled to 4x4 onscreen

    if (!selectedScreen?.pixels) return;

    selectedScreen.pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color?.value || "#000000";
        ctx.fillRect(
          x * pixelSize,
          y * pixelSize,
          pixelSize,
          pixelSize
        );
      });
    });
  };

  // ----- GAME SCREEN (tile blocks) -----

  const drawGameScreen = (ctx: CanvasRenderingContext2D) => {
    const tileSize = 16; // 8x8 doubled

    for (let y = 0; y < LOGICAL_GAME_HEIGHT; y++) {
      for (let x = 0; x < LOGICAL_GAME_WIDTH; x++) {
        const tileId = selectedScreen?.tiles?.[y]?.[x];
        if (!tileId) continue;

        const block = blocks.find((b) => b.id === tileId);
        if (!block || !block.sprite) continue;

        const sprite = block.sprite;
        const scale = tileSize / 8;

        sprite.pixels.forEach((row, py) => {
          row.forEach((colorIndex, px) => {
            if (colorIndex === 0) return;

            const spectrumColor =
              SPECTRUM_COLORS[colorIndex] || SPECTRUM_COLORS[0];

            ctx.fillStyle = spectrumColor.value;
            ctx.fillRect(
              x * tileSize + px * scale,
              y * tileSize + py * scale,
              scale,
              scale
            );
          });
        });
      }
    }
  };

  // ====== INTERACTION ======

  const handleCanvasClick = (
    e: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (!selectedScreen) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // TITLE MODE
    if (selectedScreen.type === "title") {
      const pixelSize = 4;
      const x = Math.floor(mouseX / pixelSize);
      const y = Math.floor(mouseY / pixelSize);

      const newPixels = selectedScreen.pixels.map((row) =>
        row.map((p) => p)
      );

      newPixels[y][x] = isErasing
        ? SPECTRUM_COLORS[0]
        : selectedColor;

      updateScreen({ ...selectedScreen, pixels: newPixels });
      return;
    }

    // GAME MODE
    const tileSize = 16;
    const x = Math.floor(mouseX / tileSize);
    const y = Math.floor(mouseY / tileSize);

    const newTiles = selectedScreen.tiles.map((row) => [...row]);

    if (isErasing) {
      newTiles[y][x] = "";
    } else if (selectedBlock) {
      newTiles[y][x] = selectedBlock.id;
    }

    updateScreen({ ...selectedScreen, tiles: newTiles });
  };

  // ====== CLEAR BUTTON ======

  const clearScreen = () => {
    if (!selectedScreen) return;

    if (selectedScreen.type === "title") {
      const cleared = {
        ...selectedScreen,
        pixels: Array(LOGICAL_TITLE_HEIGHT)
          .fill(null)
          .map(() =>
            Array(LOGICAL_TITLE_WIDTH).fill(SPECTRUM_COLORS[0])
          ),
      };
      updateScreen(cleared);
    } else {
      const cleared = {
        ...selectedScreen,
        tiles: Array(LOGICAL_GAME_HEIGHT)
          .fill(null)
          .map(() => Array(LOGICAL_GAME_WIDTH).fill("")),
      };
      updateScreen(cleared);
    }

    toast.success("Screen cleared");
  };

  // ====== RENDER ======

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

      {/* CANVAS PANEL */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex justify-between mb-3">
          <div className="flex gap-2">
            <Button
              variant={isErasing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsErasing(!isErasing)}
            >
              <Eraser className="w-4 h-4 mr-1" />
              Erase
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={clearScreen}
            >
              Clear
            </Button>
          </div>

          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {selectedScreen?.type?.toUpperCase()}
          </div>
        </div>

        <div className="flex justify-center bg-muted p-4 rounded border">
          <canvas
            ref={canvasRef}
            width={512}
            height={384}
            style={{
              width: "512px",
              height: "384px",
              imageRendering: "pixelated",
            }}
            onClick={handleCanvasClick}
          />
        </div>

        {/* COLOR PALETTE ONLY FOR TITLE */}
        {selectedScreen?.type === "title" && (
          <div className="mt-4">
            <ColorPalette
              selectedColor={selectedColor}
              onColorSelect={setSelectedColor}
            />
          </div>
        )}
      </Card>

      {/* SIDEBAR */}
      <div className="space-y-4">

        {/* SCREENS LIST */}
        <Card className="p-4">
          <div className="flex justify-between mb-2">
            <h3 className="text-sm font-bold">Screens</h3>
          </div>

          <div className="space-y-2">
            {screens.map((screen) => (
              <div
                key={screen.id}
                onClick={() => setSelectedScreen(screen)}
                className={`flex justify-between items-center p-2 rounded border cursor-pointer ${
                  selectedScreen?.id === screen.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <span className="text-xs font-bold">
                  {screen.name}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScreensChange(
                      screens.filter((s) => s.id !== screen.id)
                    );
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* BLOCK PALETTE (NOT FOR TITLE) */}
        {selectedScreen?.type !== "title" && (
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3">
              Block Library
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {blocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => {
                    setSelectedBlock(block);
                    setIsErasing(false);
                  }}
                  className={`border rounded p-2 ${
                    selectedBlock?.id === block.id
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  {block.name}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
