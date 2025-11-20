import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save } from "lucide-react";
import { type Level, type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({ levels, screens, onLevelsChange }: LevelDesignerProps) => {
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());

  const handleSelectScreen = (screenId: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(screenId)) {
      newSet.delete(screenId);
    } else {
      newSet.add(screenId);
    }
    setSelectedScreenIds(newSet);
  };

  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.size === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName.trim(),
      screenIds: Array.from(selectedScreenIds),
    };

    const updatedLevels = [...levels, newLevel];
    onLevelsChange(updatedLevels);

    // Reset input & selections
    setNewLevelName("");
    setSelectedScreenIds(new Set());
    setSelectedLevel(null);
  };

  const handleDeleteLevel = (levelId: string) => {
    const updatedLevels = levels.filter(l => l.id !== levelId);
    onLevelsChange(updatedLevels);
    if (selectedLevel?.id === levelId) setSelectedLevel(null);
  };

  const getScreenTypeLabel = (type: string) => {
    const labels = {
      title: "Title",
      game: "Game",
      level: "Level",
      gameover: "Game Over",
      controls: "Controls",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getScreenTypeBadgeVariant = (type: string) => {
    const variants = {
      title: "default",
      game: "secondary",
      level: "outline",
      gameover: "destructive",
      controls: "default",
    };
    return variants[type as keyof typeof variants] || "outline";
  };

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Main content: All Levels grid */}
      <div className="flex-1">
        <Card className="bg-card border-border p-4">
          <CardHeader>
            <CardTitle className="text-sm">All Levels</CardTitle>
          </CardHeader>
          <CardContent>
            {levels.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No levels created yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {levels.map((level, index) => (
                  <Card key={level.id} className="p-4 border-border bg-background">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs">{index + 1}</Badge>
                        <span className="font-medium">{level.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={() => handleDeleteLevel(level.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {/* Screens carousel */}
                    <ScrollArea className="overflow-x-auto flex gap-2">
                      {level.screenIds.map(screenId => {
                        const screen = screens.find(s => s.id === screenId);
                        if (!screen) return null;
                        return (
                          <div key={screen.id} className="relative w-32 h-24 bg-muted rounded border flex-shrink-0">
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                              {screen.name} ({getScreenTypeLabel(screen.type)})
                            </span>
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                              {/* Optionally: render small canvas or thumbnail */}
                              {screen.width}×{screen.height}
                            </div>
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right-hand: Add Level panel */}
      <div className="w-64 flex flex-col gap-4">
        <Card className="bg-card border-border p-4">
          <CardHeader>
            <CardTitle className="text-sm">Add Level</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <Input
              placeholder="Level name..."
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
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
                        <div className="flex-1 truncate">
                          {screen.name}
                        </div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => handleSelectScreen(screen.id)}
                          onClick={(e) => e.stopPropagation()}
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
