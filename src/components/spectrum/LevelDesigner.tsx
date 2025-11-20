import React, { useState, useEffect } from "react";
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
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Drag & Drop handlers
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

  // Generate thumbnails safely
  useEffect(() => {
    const newThumbs: Record<string, string> = {};
    screens.forEach(screen => {
      if (!thumbnails[screen.id]) {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 96;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const tileWidth = canvas.width / screen.width;
        const tileHeight = canvas.height / screen.height;

        for (let y = 0; y < screen.height; y++) {
          const row = screen.tiles[y];
          if (!row) continue;
          for (let x = 0; x < screen.width; x++) {
            const blockId = row[x];
            if (!blockId) continue;
            const block = blocks.find(b => b.id === blockId);
            if (!block?.sprite?.pixels) continue;
            const colorIndex = block.sprite.pixels?.[0]?.[0] ?? 7;
            const spectrumColors = [
              "#000000","#0000D7","#D70000","#D700D7","#00D700","#00D7D7","#D7D700","#D7D7D7",
              "#000000","#0000FF","#FF0000","#FF00FF","#00FF00","#00FFFF","#FFFF00","#FFFFFF"
            ];
            ctx.fillStyle = spectrumColors[colorIndex] ?? "#fff";
            ctx.fillRect(x * tileWidth, y * tileHeight, tileWidth, tileHeight);
          }
        }
        newThumbs[screen.id] = canvas.toDataURL();
      }
    });
    setThumbnails(prev => ({ ...prev, ...newThumbs }));
  }, [screens, blocks, thumbnails]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
      {/* Left/Main Panel: Level Cards */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
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
                    <img
                      src={thumbnails[screensForLevel[currentScreenIndex].id]}
                      alt={screensForLevel[currentScreenIndex].name}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    {screensForLevel.length > 1 && (
                      <>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                          onClick={e => { e.stopPropagation(); prevScreen(level.id, screensForLevel); }}
                        >
                          ◀
                        </button>
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                          onClick={e => { e.stopPropagation(); nextScreen(level.id, screensForLevel); }}
                        >
                          ▶
                        </button>
                      </>
                    )}
                    <div className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                      {screensForLevel[currentScreenIndex].name} ({screensForLevel[currentScreenIndex].type})
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

      {/* Right Panel: Add Level */}
      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="text-sm font-bold text-primary mb-2">Add Level</h3>
          <Input
            value={newLevelName}
            onChange={e => setNewLevelName(e.target.value)}
            placeholder="Level name"
            className="mb-4"
          />
          <div className="space-y-1 max-h-64 overflow-auto mb-4">
            {screens.map(screen => (
              <label
                key={screen.id}
                className="flex items-center justify-between p-2 rounded border cursor-pointer transition-all border-border hover:border-primary/50"
              >
                <span className="text-sm truncate flex-1">{screen.name}</span>
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
    </div>
  );
};
