import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { type Screen, type ScreenType, type Block } from "@/types/spectrum";
import { Plus, Trash2, Eraser } from "lucide-react";
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
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(screens[0]?.id || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedScreen = screens.find(s => s.id === selectedScreenId) ?? null;

  useEffect(() => {
    if (selectedScreen) drawScreen(selectedScreen);
  }, [selectedScreen, blocks]);

  // ✅ Safe Screen Creation
  const createEmptyScreen = (): Screen => ({
    id: `screen-${Date.now()}`,
    name: `Screen ${screens.length + 1}`,
    type: "level",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    tiles: Array.from({ length: SCREEN_HEIGHT }, () =>
      Array(SCREEN_WIDTH).fill("")
    )
  });

  const handleAddScreen = () => {
    const newScreen = createEmptyScreen();
    const updated = [...screens, newScreen];
    onScreensChange(updated);
    setSelectedScreenId(newScreen.id);
    toast.success("Screen added");
  };

  const drawScreen = (screen: Screen) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = SCREEN_WIDTH * TILE_SIZE;
    canvas.height = SCREEN_HEIGHT * TILE_SIZE;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    screen.tiles.forEach((row, y) => {
      row.forEach((blockId, x) => {
        const block = blocks.find(b => b.id === blockId);
        if (block) drawBlock(ctx, block, x, y);
      });
    });
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, block: Block, gridX: number, gridY: number) => {
    const [w, h] = block.sprite.size.split("x").map(Number);
    const scale = TILE_SIZE / 8;

    block.sprite.pixels.forEach((row, py) => {
      row.forEach((col, px) => {
        if (col !== 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(
            gridX * TILE_SIZE + px * scale,
            gridY * TILE_SIZE + py * scale,
            scale,
            scale
          );
        }
      });
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen || !selectedBlock) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

    const newTiles = selectedScreen.tiles.map(row => [...row]);
    newTiles[y][x] = selectedBlock.id;

    const updatedScreen = { ...selectedScreen, tiles: newTiles };

    onScreensChange(
      screens.map(s =>
        s.id === selectedScreen.id ? updatedScreen : s
      )
    );
  };

  const updateScreen = (updated: Screen) => {
    onScreensChange(
      screens.map(s => s.id === updated.id ? updated : s)
    );
  };

  const deleteScreen = (id: string) => {
    const updated = screens.filter(s => s.id !== id);
    onScreensChange(updated);
    if (selectedScreenId === id) {
      setSelectedScreenId(updated[0]?.id ?? null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

      {/* Main Canvas */}
      <Card className="lg:col-span-3 p-4">
        {selectedScreen ? (
          <>
            {/* Screen Header */}
            <div className="flex items-center gap-3 mb-4">
              <Input
                value={selectedScreen.name}
                onChange={(e) =>
                  updateScreen({ ...selectedScreen, name: e.target.value })
                }
                className="max-w-xs"
              />

              {/* ✅ Screen Type Dropdown Restored */}
              <Select
                value={selectedScreen.type}
                onValueChange={(value: ScreenType) =>
                  updateScreen({ ...selectedScreen, type: value })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
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

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="border border-border rounded cursor-crosshair"
              onClick={handleCanvasClick}
              style={{ imageRendering: "pixelated" }}
            />
          </>
        ) : (
          <div className="text-center p-6 text-muted-foreground">
            No screen selected.
          </div>
        )}
      </Card>

      {/* Sidebar */}
      <div className="space-y-4">

        {/* Screen List */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Screens</h3>
            <Button size="sm" onClick={handleAddScreen}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {screens.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No screens yet
            </p>
          )}

          <div className="space-y-2">
            {screens.map(screen => (
              <div
                key={screen.id}
                onClick={() => setSelectedScreenId(screen.id)}
                className={`
                  flex items-center justify-between p-2 border rounded cursor-pointer
                  ${selectedScreenId === screen.id ? "border-primary bg-primary/10" : "border-border"}
                `}
              >
                <span className="text-sm truncate">
                  {screen.name}  
                  <span className="ml-2 text-xs opacity-70">
                    ({screen.type})
                  </span>
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteScreen(screen.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Block Selector */}
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-2">Blocks</h3>
          <div className="grid grid-cols-4 gap-2">
            {blocks.map(block => (
              <button
                key={block.id}
                onClick={() => setSelectedBlock(block)}
                className={`
                  text-xs p-2 rounded border
                  ${selectedBlock?.id === block.id ? "border-primary bg-primary/10" : "border-border"}
                `}
              >
                {block.name}
              </button>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
};
