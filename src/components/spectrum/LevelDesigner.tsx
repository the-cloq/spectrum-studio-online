import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [screenIndices, setScreenIndices] = useState<Record<string, number>>({});

  // Drag & Drop Handlers
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

  // Carousel navigation for screens within a level
  const nextScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) + 1) % screensForLevel.length,
    }));
  };

  const prevScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) - 1 + screensForLevel.length) % screensForLevel.length,
    }));
  };

  // Delete a level
  const handleDeleteLevel = (id: string) => {
    onLevelsChange(levels.filter(l => l.id !== id));
  };

  // Create a new level
  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.length === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: selectedScreenIds,
    };
    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
    setSelectedScreenIds([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
      {/* Left/Main Panel: Levels List */}
      <div className="lg:col-span-3 space-y-3">
        {levels.map((level, index) => {
          const screensForLevel = screens.filter(s => level.screenIds.includes(s.id));
          const currentIndex = screenIndices[level.id] ?? 0;
          const currentScreen = screensForLevel[currentIndex];

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

              {/* Screen Thumbnail */}
              {currentScreen ? (
                <canvas
                  width={256}
                  height={192}
                  className="w-full h-full bg-gray-900"
                  ref={canvas => {
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.fillStyle = "#000";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = "#fff";
                    ctx.font = "16px monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(currentScreen.name, canvas.width / 2, canvas.height / 2);
                  }}
                />
              ) : (
                <div className="w-full pt-[75%] bg-gray-700 rounded flex items-center justify-center text-white text-xs">
                  Missing Screen
                </div>
              )}

              {/* Carousel Controls for multiple screens */}
              {screensForLevel.length > 1 && (
                <div className="flex justify-between mt-2 text-xs">
                  <Button size="sm" variant="outline" onClick={() => prevScreen(level.id, screensForLevel)}>
                    Prev
                  </Button>
                  <span>
                    {currentIndex + 1} / {screensForLevel.length}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => nextScreen(level.id, screensForLevel)}>
                    Next
                  </Button>
                </div>
              )}

              {/* Delete Level Button */}
              <Button variant="ghost" size="sm" onClick={() => handleDeleteLevel(level.id)} className="mt-2 self-end">
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Right Panel: Add Level */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4">
        <h3 className="text-sm font-bold text-primary mb-2">Add Level</h3>
        <Input
          value={newLevelName}
          onChange={e => setNewLevelName(e.target.value)}
          placeholder="Level name"
        />
        <div className="space-y-1 max-h-64 overflow-auto">
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
