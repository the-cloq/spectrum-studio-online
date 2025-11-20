// LevelDesigner.tsx
// Draft implementation based on your spec: create level -> assign screens -> order screens -> save -> show level grid with draggable cards

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical } from "lucide-react";
import { type Screen, type Level } from "@/types/spectrum";

interface LevelDesignerProps {
  screens: Screen[];
  levels: Level[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({ screens, levels, onLevelsChange }: LevelDesignerProps) => {
  const [mode, setMode] = useState<"create" | "editor" | "grid">(levels.length ? "grid" : "create");
  const [levelName, setLevelName] = useState<string>("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);

  // CREATE LEVEL STEP
  const handleCreateLevel = () => {
    if (!levelName || selectedScreenIds.length === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: levelName,
      screens: selectedScreenIds,
    };

    setEditingLevel(newLevel);
    setMode("editor");
  };

  // EDIT LEVEL ORDER STEP
  const moveScreen = (from: number, to: number) => {
    if (!editingLevel) return;
    const newScreens = [...editingLevel.screens];
    const [moved] = newScreens.splice(from, 1);
    newScreens.splice(to, 0, moved);

    setEditingLevel({ ...editingLevel, screens: newScreens });
  };

  const handleSaveLevel = () => {
    if (!editingLevel) return;
    const updated = [...levels, editingLevel];
    onLevelsChange(updated);
    setMode("grid");
  };

  // GRID VIEW DRAG LOGIC
  const moveLevel = (from: number, to: number) => {
    const updated = [...levels];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onLevelsChange(updated);
  };

  // ================= UI ==================

  // STEP 1: CREATE LEVEL
  if (mode === "create") {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold">Create Level</h2>

        <div className="space-y-2">
          <Label>Level Name</Label>
          <Input value={levelName} onChange={(e) => setLevelName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Select Screens</Label>
          <div className="grid grid-cols-2 gap-2">
            {screens.map(screen => (
              <button
                key={screen.id}
                className={`p-2 border rounded text-left ${selectedScreenIds.includes(screen.id) ? "border-primary bg-primary/10" : "border-border"}`}
                onClick={() => {
                  if (selectedScreenIds.includes(screen.id)) {
                    setSelectedScreenIds(selectedScreenIds.filter(id => id !== screen.id));
                  } else {
                    setSelectedScreenIds([...selectedScreenIds, screen.id]);
                  }
                }}
              >
                {screen.name}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleCreateLevel}>Create Level</Button>
      </Card>
    );
  }

  // STEP 2: SCREEN ORDER EDITOR
  if (mode === "editor" && editingLevel) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold">Arrange Screens: {editingLevel.name}</h2>

        <div className="flex gap-4 overflow-x-auto">
          {editingLevel.screens.map((screenId, index) => {
            const screen = screens.find(s => s.id === screenId);
            if (!screen) return null;

            return (
              <div key={screenId} className="min-w-[200px] border rounded p-3 bg-muted relative">
                <div className="absolute top-2 left-2 cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="text-sm font-bold mb-1">{screen.name}</div>
                <div className="text-xs text-muted-foreground mb-2">Position: {index + 1}</div>

                <div className="flex gap-2">
                  {index > 0 && (
                    <Button size="sm" variant="outline" onClick={() => moveScreen(index, index - 1)}>←</Button>
                  )}
                  {index < editingLevel.screens.length - 1 && (
                    <Button size="sm" variant="outline" onClick={() => moveScreen(index, index + 1)}>→</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={handleSaveLevel} className="mt-4">Save Level</Button>
      </Card>
    );
  }

  // STEP 3: LEVEL GRID OVERVIEW
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Level Map</h2>
        <Button onClick={() => setMode("create")}>+ New Level</Button>
      </div>

      <div className="flex flex-wrap gap-4">
        {levels.map((level, index) => (
          <div key={level.id} className="w-64 border rounded p-4 bg-background relative">
            <div className="absolute top-2 left-2 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="font-bold ml-6">{level.name}</div>
            <div className="ml-6 text-xs inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Level {index + 1}
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              {level.screens.length} screen(s)
            </div>

            <div className="flex gap-2 mt-4">
              {index > 0 && (
                <Button size="sm" variant="outline" onClick={() => moveLevel(index, index - 1)}>←</Button>
              )}
              {index < levels.length - 1 && (
                <Button size="sm" variant="outline" onClick={() => moveLevel(index, index + 1)}>→</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
