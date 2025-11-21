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

export const LevelDesigner = ({ levels, screens, blocks, onLevelsChange }: LevelDesignerProps) => {
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [screenIndices, setScreenIndices] = useState<Record<string, number>>({});

  // Drag & Drop
  const handleDragStart = (index: number) => setDraggingIndex(index);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setHoveredIndex(index);
  };
  const handleDragEnd = () => {
    if (draggingIndex === null || hoveredIndex === null || draggingIndex === hoveredIndex) {
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

  // Carousel
  const nextScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) + 1) % screensForLevel.length
    }));
  };

  const prevScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) - 1 + screensForLevel.length) % screensForLevel.length
    }));
  };

  const handleDeleteLevel = (id: string) => {
    onLevelsChange(levels.filter(l => l.id !== id));
  };

  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.length === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: selectedScreenIds
    };
    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
    setSelectedScreenIds([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Left/Main Panel: Level Cards */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 lg:col-span-3">
        <h2 className="text-lg font-bold text-primary mb-4">Levels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                className={`relative p-4 border rounded flex flex-col gap-2 cursor-move group ${
                  draggingIndex === index ? "opacity-50" : ""
                }`}
              >
                {/* Top Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span>{level.name}</span>
                  </div>
                  <Badge>{index + 1}</Badge>
                </div>

                {/* Screen Carousel */}
                {screensForLevel.length > 0 ? (
                  <div className="relative w-full pt-[75%] bg-muted rounded overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <canvas
                        width={256}
                        height={192}
                        className="w-full h-full bg-gray-900"
                        ref={canvas => {
                          if (!canvas || !screensForLevel[currentScreenIndex]) return;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;
                          
                          const screen = screensForLevel[currentScreenIndex];
                          
                          // Clear background
                          ctx.fillStyle = "#000";
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          
                          // Render screen content
                          if (screen.type === "title" && screen.pixels) {
                            // Render title screen pixels
                            for (let y = 0; y < 192; y++) {
                              for (let x = 0; x < 256; x++) {
                                const color = screen.pixels[y]?.[x];
                                if (color) {
                                  ctx.fillStyle = color.value;
                                  ctx.fillRect(x, y, 1, 1);
                                }
                              }
                            }
                          } else if (screen.type === "game" && screen.tiles) {
                            // Render game screen tiles
                            const blockSize = 16;
                            for (let row = 0; row < 12; row++) {
                              for (let col = 0; col < 16; col++) {
                                const blockId = screen.tiles[row]?.[col];
                                if (blockId) {
                                  const block = blocks.find(b => b.id === blockId);
                                  if (block?.sprite?.pixels) {
                                    // Render block sprite
                                    for (let y = 0; y < 16; y++) {
                                      for (let x = 0; x < 16; x++) {
                                        const colorIndex = block.sprite.pixels[y]?.[x];
                                        if (colorIndex !== undefined && colorIndex !== 0) {
                                          ctx.fillStyle = `hsl(${colorIndex * 30}, 70%, 50%)`;
                                          ctx.fillRect(col * blockSize + x, row * blockSize + y, 1, 1);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }}
                      />
                      {screensForLevel.length > 1 && (
                        <>
                          <button
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); prevScreen(level.id, screensForLevel); }}
                          >
                            ◀
                          </button>
                          <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); nextScreen(level.id, screensForLevel); }}
                          >
                            ▶
                          </button>
                        </>
                      )}
                      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                        {screensForLevel[currentScreenIndex].name} ({screensForLevel[currentScreenIndex].type || 'game'})
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full pt-[75%] bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                    No screens
                  </div>
                )}

                {/* Delete Level */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteLevel(level.id)}
                  className="mt-2"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Right Panel: Add Level */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4">
        <h3 className="text-sm font-bold text-primary mb-2">Add Level</h3>
        <Input
          value={newLevelName}
          onChange={e => setNewLevelName(e.target.value)}
          placeholder="Level name"
        />
        <div className="space-y-1 max-h-64 overflow-auto">
          <h4 className="text-sm font-bold text-primary mb-2">Include Screens</h4>
          {screens.map(screen => (
            <label
              key={screen.id}
              className="flex items-center justify-between p-2 rounded border cursor-pointer transition-all border-border hover:border-primary/50"
            >
              <span className="text-sm truncate">{screen.name}</span>
              <Checkbox
                checked={selectedScreenIds.includes(screen.id)}
                onCheckedChange={checked => {
                  if (checked) {
                    setSelectedScreenIds([...selectedScreenIds, screen.id]);
                  } else {
                    setSelectedScreenIds(selectedScreenIds.filter(id => id !== screen.id));
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
