import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Grip } from "lucide-react";
import { type Level, type Screen, type Block } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  blocks: Block[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({
  levels,
  screens,
  blocks,
  onLevelsChange
}: LevelDesignerProps) => {

  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [screenIndices, setScreenIndices] = useState<Record<string, number>>({});

  // --------------------------
  // Drag + Drop
  // --------------------------
  const handleDragStart = (index: number) => setDraggingIndex(index);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setHoveredIndex(index);
  };

  const handleDragEnd = () => {
    if (
      draggingIndex === null ||
      hoveredIndex === null ||
      draggingIndex === hoveredIndex
    ) {
      setDraggingIndex(null);
      setHoveredIndex(null);
      return;
    }

    const reordered = [...levels];
    const [moved] = reordered.splice(draggingIndex, 1);
    reordered.splice(hoveredIndex, 0, moved);

    onLevelsChange(reordered);

    setDraggingIndex(null);
    setHoveredIndex(null);
  };

  // --------------------------
  // Carousel controls
  // --------------------------
  const nextScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) + 1) % screensForLevel.length
    }));
  };

  const prevScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]:
        ((prev[levelId] ?? 0) - 1 + screensForLevel.length) %
        screensForLevel.length
    }));
  };

  // --------------------------
  // Actions
  // --------------------------
  const handleDeleteLevel = (id: string) => {
    onLevelsChange(levels.filter(l => l.id !== id));
  };

  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.length === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName.trim(),
      screenIds: selectedScreenIds
    };

    onLevelsChange([...levels, newLevel]);

    setNewLevelName("");
    setSelectedScreenIds([]);
  };

  // --------------------------
  // JSX
  // --------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

      {/* LEFT: LEVEL LIST */}
      <Card className="p-4 lg:col-span-3">
        <h2 className="text-lg font-bold mb-4">Levels</h2>

        {/* FIXED stacking - no overlap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {levels.map((level, index) => {

            const screensForLevel = level.screenIds
              .map(id => screens.find(s => s.id === id))
              .filter(Boolean) as Screen[];

            const currentScreenIndex = screenIndices[level.id] ?? 0;

            return (
              <Card
                key={level.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-4 flex flex-col gap-3 border rounded cursor-move bg-card group transition ${
                  draggingIndex === index ? "opacity-50" : ""
                }`}
              >

                {/* HEADER */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span className="font-medium">{level.name}</span>
                  </div>
                  <Badge>{index + 1}</Badge>
                </div>

                {/* SCREEN PREVIEW */}
                {screensForLevel.length > 0 ? (
                  <div className="relative w-full aspect-[4/3] bg-muted rounded overflow-hidden">

                    <canvas
                      width={256}
                      height={192}
                      className="w-full h-full"
                      ref={canvas => {
                        if (!canvas || !screensForLevel[currentScreenIndex]) return;

                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;

                        const screen = screensForLevel[currentScreenIndex];

                        ctx.fillStyle = "#000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        if (screen.type === "title" && screen.pixels) {
                          for (let y = 0; y < 192; y++) {
                            for (let x = 0; x < 256; x++) {
                              const color = screen.pixels[y]?.[x];
                              if (color) {
                                ctx.fillStyle = color.value;
                                ctx.fillRect(x, y, 1, 1);
                              }
                            }
                          }
                        }

                        if (screen.type === "game" && screen.tiles) {
                          const blockSize = 16;

                          for (let row = 0; row < 12; row++) {
                            for (let col = 0; col < 16; col++) {
                              const blockId = screen.tiles[row]?.[col];
                              const block = blocks.find(b => b.id === blockId);

                              if (!block?.sprite?.pixels) continue;

                              for (let y = 0; y < 16; y++) {
                                for (let x = 0; x < 16; x++) {
                                  const colorIndex = block.sprite.pixels[y]?.[x];
                                  if (colorIndex) {
                                    ctx.fillStyle = `hsl(${colorIndex * 30}, 70%, 50%)`;
                                    ctx.fillRect(col * blockSize + x, row * blockSize + y, 1, 1);
                                  }
                                }
                              }
                            }
                          }
                        }
                      }}
                    />

                    {/* Carousel controls */}
                    {screensForLevel.length > 1 && (
                      <>
                        <button
                          className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded"
                          onClick={e => {
                            e.stopPropagation();
                            prevScreen(level.id, screensForLevel);
                          }}
                        >
                          ◀
                        </button>
                        <button
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded"
                          onClick={e => {
                            e.stopPropagation();
                            nextScreen(level.id, screensForLevel);
                          }}
                        >
                          ▶
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-2 py-1 rounded">
                      {screensForLevel[currentScreenIndex]?.name}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[4/3] bg-gray-800 rounded flex items-center justify-center text-xs text-white">
                    No screens
                  </div>
                )}

                {/* DELETE */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteLevel(level.id)}
                  className="self-start"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

              </Card>
            );
          })}
        </div>
      </Card>

      {/* RIGHT: ADD LEVEL */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold">Add Level</h3>

        <Input
          value={newLevelName}
          onChange={e => setNewLevelName(e.target.value)}
          placeholder="Level name"
        />

        <div className="space-y-1 max-h-64 overflow-auto">
          {screens.map(screen => (
            <label
              key={screen.id}
              className="flex items-center justify-between p-2 border rounded cursor-pointer hover:border-primary transition"
            >
              <span className="text-sm truncate">{screen.name}</span>
              <Checkbox
                checked={selectedScreenIds.includes(screen.id)}
                onCheckedChange={checked => {
                  if (checked) {
                    setSelectedScreenIds(prev => [...prev, screen.id]);
                  } else {
                    setSelectedScreenIds(prev =>
                      prev.filter(id => id !== screen.id)
                    );
                  }
                }}
              />
            </label>
          ))}
        </div>

        <Button
          onClick={handleCreateLevel}
          disabled={!newLevelName.trim() || selectedScreenIds.length === 0}
          className="w-full"
        >
          Add Level
        </Button>
      </Card>
    </div>
  );
};
