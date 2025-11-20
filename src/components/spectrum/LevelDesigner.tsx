import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Level, type Screen } from "@/types/spectrum";
import { Plus, Trash2, Grip } from "lucide-react";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  onLevelsChange: (levels: Level[]) => void;
}

export function LevelDesigner({ levels, screens, onLevelsChange }: LevelDesignerProps) {
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleSelectScreen = (screenId: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(screenId)) newSet.delete(screenId);
    else newSet.add(screenId);
    setSelectedScreenIds(newSet);
  };

  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.size === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: Array.from(selectedScreenIds),
    };
    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
    setSelectedScreenIds(new Set());
  };

  const handleDeleteLevel = (levelId: string) => {
    onLevelsChange(levels.filter(l => l.id !== levelId));
  };

  // Drag and Drop Handlers
  const handleDragStart = (index: number) => setDraggedIndex(index);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newLevels = [...levels];
    const draggedItem = newLevels[draggedIndex];
    newLevels.splice(draggedIndex, 1);
    newLevels.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    onLevelsChange(newLevels);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const getScreenLabel = (screenId: string) => {
    const screen = screens.find(s => s.id === screenId);
    return screen ? `${screen.name} (${screen.type})` : "Unknown Screen";
  };

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Left Panel: Create Level */}
      <div className="w-64 flex flex-col gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Create Level</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Input
              placeholder="Level name..."
              value={newLevelName}
              onChange={e => setNewLevelName(e.target.value)}
              className="mb-2"
            />
            <div className="space-y-2 max-h-64 overflow-y-auto mb-2">
              {screens.map(screen => (
                <div
                  key={screen.id}
                  className={`p-2 border rounded cursor-pointer ${
                    selectedScreenIds.has(screen.id)
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectScreen(screen.id)}
                >
                  {screen.name} ({screen.type})
                </div>
              ))}
            </div>
            <Button
              onClick={handleCreateLevel}
              disabled={!newLevelName.trim() || selectedScreenIds.size === 0}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Level
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: All Levels Grid */}
      <div className="flex-1">
        <h2 className="text-lg font-bold mb-4">All Levels</h2>
        {levels.length === 0 && <p className="text-muted-foreground">No levels created yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {levels.map((level, index) => (
            <Card
              key={level.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className="p-4 border rounded flex flex-col gap-2 cursor-move"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Grip className="w-4 h-4" />
                  <span>{level.name}</span>
                </div>
                <Badge>Level {index + 1}</Badge>
              </div>
              <div className="space-y-1">
                {level.screenIds.map(screenId => (
                  <div key={screenId} className="text-xs text-muted-foreground">
                    {getScreenLabel(screenId)}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteLevel(level.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
