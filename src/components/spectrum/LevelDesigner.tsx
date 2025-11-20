import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Reorder, motion } from "framer-motion";
import { type Level, type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({ levels, screens, onLevelsChange }: LevelDesignerProps) => {
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());
  const [screenIndices, setScreenIndices] = useState<{ [levelId: string]: number }>({});

  // Handle selecting screens in Add Level panel
  const handleSelectScreen = (screenId: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(screenId)) newSet.delete(screenId);
    else newSet.add(screenId);
    setSelectedScreenIds(newSet);
  };

  // Create a new level
  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.size === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName.trim(),
      screenIds: Array.from(selectedScreenIds),
    };

    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
    setSelectedScreenIds(new Set());
  };

  // Delete a level
  const handleDeleteLevel = (levelId: string) => {
    onLevelsChange(levels.filter(l => l.id !== levelId));
  };

  // Screen type label
  const getScreenTypeLabel = (type: string) => {
    const labels = { title: "Title", game: "Game", level: "Level", gameover: "Game Over", controls: "Controls" };
    return labels[type as keyof typeof labels] || type;
  };

  // Handle carousel arrow click
  const handleCarouselNext = (level: Level) => {
    setScreenIndices(prev => ({ ...prev, [level.id]: ((prev[level.id] || 0) + 1) % level.screenIds.length }));
  };
  const handleCarouselPrev = (level: Level) => {
    setScreenIndices(prev => ({
      ...prev,
      [level.id]: ((prev[level.id] || 0) - 1 + level.screenIds.length) % level.screenIds.length,
    }));
  };

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Main content: All Levels */}
      <div className="flex-1">
        <Reorder.Group
          axis="x"
          values={levels}
          onReorder={onLevelsChange}
          className="flex flex-wrap gap-4"
        >
          {levels.map((level, index) => {
            const currentIndex = screenIndices[level.id] || 0;
            const currentScreenId = level.screenIds[currentIndex];
            const currentScreen = screens.find(s => s.id === currentScreenId);

            return (
              <Reorder.Item key={level.id} value={level}>
                <Card className="relative w-60 border-border bg-background flex flex-col">
                  {/* Drag handle */}
                  <div className="absolute top-2 left-2 cursor-grab">
                    <GripHorizontal className="w-5 h-5" />
                  </div>

                  {/* Level pill top-right */}
                  <div className="absolute top-2 right-2">
                    <Badge className="text-xs">{index + 1}</Badge>
                  </div>

                  {/* Screen carousel */}
                  {currentScreen ? (
                    <div className="relative w-full h-40 overflow-hidden rounded mt-8 bg-muted flex items-center justify-center">
                      <img
                        src={currentScreen.thumbnail || ""}
                        alt={currentScreen.name}
                        className="object-cover w-full h-full"
                      />
                      {/* Screen pill */}
                      <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                        {currentScreen.name} ({getScreenTypeLabel(currentScreen.type)})
                      </span>
                      {/* Carousel arrows */}
                      {level.screenIds.length > 1 && (
                        <>
                          <button
                            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 text-white p-1 rounded hover:bg-black/70"
                            onClick={() => handleCarouselPrev(level)}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 text-white p-1 rounded hover:bg-black/70"
                            onClick={() => handleCarouselNext(level)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 bg-muted flex items-center justify-center text-muted-foreground">
                      No screens
                    </div>
                  )}

                  {/* Bottom: Delete button */}
                  <div className="flex justify-end p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-6 w-6"
                      onClick={() => handleDeleteLevel(level.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>

      {/* Right-hand panel: Add Level */}
      <div className="w-64 flex flex-col gap-4">
        <Card className="bg-card border-border p-4">
          <CardHeader>
            <CardTitle className="text-sm">Add Level</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <Input
              placeholder="Level name..."
              value={newLevelName}
              onChange={e => setNewLevelName(e.target.value)}
              className="mb-4 text-sm bg-background border-border"
            />
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 p-2">
                {screens.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No screens available. Create screens first.
                  </div>
                ) : (
                  screens.map(screen => {
                    const checked = selectedScreenIds.has(screen.id);
                    return (
                      <div
                        key={screen.id}
                        className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
                        onClick={() => handleSelectScreen(screen.id)}
                      >
                        <div className="flex-1 truncate">{screen.name}</div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => handleSelectScreen(screen.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <Button
              className="mt-4 w-full"
              onClick={handleCreateLevel}
              disabled={!newLevelName.trim() || selectedScreenIds.size === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Level
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
