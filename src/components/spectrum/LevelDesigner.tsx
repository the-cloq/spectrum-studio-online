import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Grip } from "lucide-react";
import { type Level, type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({ levels, screens, onLevelsChange }: LevelDesignerProps) => {
  const [newLevelName, setNewLevelName] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Track current screen per level
  const [screenIndices, setScreenIndices] = useState<Record<string, number>>({});

  const handleCreateLevel = () => {
    if (!newLevelName.trim()) return;
    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: [], // initially empty
    };
    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
  };

  const handleDeleteLevel = (id: string) => {
    onLevelsChange(levels.filter(l => l.id !== id));
    // remove screen index tracking for deleted level
    setScreenIndices(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // Drag & Drop
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

  const nextScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => {
      const current = prev[levelId] ?? 0;
      return { ...prev, [levelId]: (current + 1) % screensForLevel.length };
    });
  };

  const prevScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => {
      const current = prev[levelId] ?? 0;
      return {
        ...prev,
        [levelId]: current === 0 ? screensForLevel.length - 1 : current - 1,
      };
    });
  };

  return (
    <div className="p-4">
      {/* Create Level */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newLevelName}
          onChange={e => setNewLevelName(e.target.value)}
          placeholder="New level name..."
          className="bg-background border-border text-sm"
        />
        <Button onClick={handleCreateLevel} disabled={!newLevelName.trim()}>
          Add Level
        </Button>
      </div>

      {/* Grid of Level Cards */}
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
              {/* Top Row: Level Name + Badge */}
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
                  {/* Displayed screen */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <canvas
                      width={256}
                      height={192}
                      className="w-full h-full bg-gray-900"
                      ref={canvas => {
                        if (!canvas) return;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return;
                        const screen = screensForLevel[currentScreenIndex];
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = "#fff";
                        ctx.font = "16px monospace";
                        ctx.textAlign = "center";
                        ctx.fillText(screen.name, canvas.width / 2, canvas.height / 2);
                      }}
                    />

                    {/* Left Arrow */}
                    {screensForLevel.length > 1 && (
                      <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                        onClick={e => {
                          e.stopPropagation();
                          prevScreen(level.id, screensForLevel);
                        }}
                      >
                        ◀
                      </button>
                    )}

                    {/* Right Arrow */}
                    {screensForLevel.length > 1 && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                        onClick={e => {
                          e.stopPropagation();
                          nextScreen(level.id, screensForLevel);
                        }}
                      >
                        ▶
                      </button>
                    )}

                    {/* Bottom-left overlay pill */}
                    <div className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                      {screensForLevel[currentScreenIndex].name} (
                      {screensForLevel[currentScreenIndex].type})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full pt-[75%] bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                  No screens
                </div>
              )}

              {/* Delete button */}
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
    </div>
  );
};
