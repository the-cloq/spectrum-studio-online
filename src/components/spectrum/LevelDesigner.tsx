import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Save, Plus, Grip } from "lucide-react";
import { type Level, type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  onLevelsChange: (levels: Level[]) => void;
}

export function LevelDesigner({ levels, screens, onLevelsChange }: LevelDesignerProps) {
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(levels[0] || null);
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());
  const [isLevelView, setIsLevelView] = useState(false);

  // Create a new level from selected screens
  const handleCreateLevelView = () => {
    if (!newLevelName.trim()) return;
    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: Array.from(selectedScreenIds),
    };
    const updatedLevels = [...levels, newLevel];
    onLevelsChange(updatedLevels);
    setSelectedLevel(newLevel);
    setIsLevelView(true);
    setNewLevelName("");
  };

  const handleSaveLevel = () => {
    if (!selectedLevel) return;
    const updatedLevels = levels.map(level =>
      level.id === selectedLevel.id
        ? { ...level, screenIds: Array.from(selectedScreenIds) }
        : level
    );
    onLevelsChange(updatedLevels);
    setSelectedLevel({ ...selectedLevel, screenIds: Array.from(selectedScreenIds) });
    setIsLevelView(false); // go back to levels grid view
  };

  const handleSelectScreen = (screenId: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(screenId)) {
      newSet.delete(screenId);
    } else {
      newSet.add(screenId);
    }
    setSelectedScreenIds(newSet);
  };

  const handleDeleteLevel = (levelId: string) => {
    const updatedLevels = levels.filter(l => l.id !== levelId);
    onLevelsChange(updatedLevels);
    if (selectedLevel?.id === levelId) setSelectedLevel(updatedLevels[0] || null);
  };

  const getScreenLabel = (screen: Screen) => `${screen.name} (${screen.type})`;

  // Screens selected for current level
  const screensInLevel = selectedLevel?.screenIds
    ? screens.filter(screen => selectedLevel.screenIds.includes(screen.id))
    : [];

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Left Panel: Create Level */}
      {!isLevelView && (
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
              <ScrollArea className="h-64 mb-2">
                <div className="space-y-2">
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
                      {getScreenLabel(screen)}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Button
                onClick={handleCreateLevelView}
                disabled={!newLevelName.trim() || selectedScreenIds.size === 0}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Level View
              </Button>
            </CardContent>
          </Card>

          {/* Levels Grid */}
          <Card className="bg-card border-border mt-4">
            <CardHeader>
              <CardTitle>All Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {levels.map((level, index) => (
                    <div
                      key={level.id}
                      className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Grip className="w-4 h-4 cursor-move" />
                        <span>{level.name}</span>
                        <Badge>{index + 1}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLevel(level.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {levels.length === 0 && <p className="text-xs text-muted-foreground">No levels created</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Right Panel: Level View */}
      {isLevelView && selectedLevel && (
        <div className="flex-1">
          <Card className="bg-card border-border">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{selectedLevel.name}</CardTitle>
              <Button size="sm" onClick={handleSaveLevel}>
                <Save className="w-4 h-4 mr-2" />
                Save Level
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {screensInLevel.length === 0 && (
                  <p className="text-xs text-muted-foreground">No screens in this level</p>
                )}
                {screensInLevel.map((screen, idx) => (
                  <Card
                    key={screen.id}
                    className="p-2 border rounded flex items-center justify-between"
                  >
                    <span>{getScreenLabel(screen)}</span>
                    <Badge>Screen {idx + 1}</Badge>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
