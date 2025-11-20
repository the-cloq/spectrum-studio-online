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
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(levels[0] || null);
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(
    new Set(selectedLevel?.screenIds || [])
  );

  const handleCreateLevel = () => {
    if (!newLevelName.trim()) return;
    
    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: [],
    };
    
    const updatedLevels = [...levels, newLevel];
    onLevelsChange(updatedLevels);
    setSelectedLevel(newLevel);
    setNewLevelName("");
  };

  const handleDeleteLevel = (levelId: string) => {
    const updatedLevels = levels.filter(l => l.id !== levelId);
    onLevelsChange(updatedLevels);
    if (selectedLevel?.id === levelId) {
      setSelectedLevel(updatedLevels[0] || null);
    }
  };

  const handleToggleScreen = (screenId: string) => {
    const newSet = new Set(selectedScreenIds);
    if (newSet.has(screenId)) {
      newSet.delete(screenId);
    } else {
      newSet.add(screenId);
    }
    setSelectedScreenIds(newSet);
  };

  const handleSaveScreenAssignments = () => {
    if (!selectedLevel) return;
    
    const updatedLevels = levels.map(level =>
      level.id === selectedLevel.id
        ? { ...level, screenIds: Array.from(selectedScreenIds) }
        : level
    );
    
    onLevelsChange(updatedLevels);
    setSelectedLevel({ ...selectedLevel, screenIds: Array.from(selectedScreenIds) });
  };

  const handleSelectLevel = (level: Level) => {
    setSelectedLevel(level);
    setSelectedScreenIds(new Set(level.screenIds));
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
    <div className="flex h-full gap-4">
      {/* Levels List */}
      <div className="w-64 flex flex-col gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Levels</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex gap-2 mb-4">
              <Input
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
                placeholder="Level name..."
                className="text-sm bg-background border-border"
              />
              <Button 
                size="sm" 
                onClick={handleCreateLevel}
                disabled={!newLevelName.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {levels.map((level, index) => (
                  <div
                    key={level.id}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedLevel?.id === level.id
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                    onClick={() => handleSelectLevel(level)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">
                          {level.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {level.screenIds.length} screen{level.screenIds.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLevel(level.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Screen Assignment Area */}
      <div className="flex-1">
        <Card className="bg-card border-border h-full">
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {selectedLevel ? `Assign Screens to "${selectedLevel.name}"` : "Select a Level"}
              </CardTitle>
              {selectedLevel && (
                <Button size="sm" onClick={handleSaveScreenAssignments}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {selectedLevel ? (
              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {screens.map((screen) => {
                    const isSelected = selectedScreenIds.has(screen.id);
                    return (
                      <Card
                        key={screen.id}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? "ring-2 ring-primary bg-primary/5"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => handleToggleScreen(screen.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleScreen(screen.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {screen.name}
                              </div>
                              <Badge 
                                variant={getScreenTypeBadgeVariant(screen.type) as any}
                                className="text-xs mt-1"
                              >
                                {getScreenTypeLabel(screen.type)}
                              </Badge>
                            </div>
                          </div>
                          <div className="aspect-video bg-muted rounded border border-border flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">
                              {screen.width}×{screen.height}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {screens.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No screens available. Create screens in the Screens tab first.
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Create or select a level to assign screens
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
