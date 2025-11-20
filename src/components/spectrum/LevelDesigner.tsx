import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  screens: Screen[];
  onAddLevel: (name: string, screenIds: string[]) => void;
  onSelectLevel?: (level: Screen) => void;
}

export function LevelDesigner({
  screens,
  onAddLevel,
  onSelectLevel
}: LevelDesignerProps) {
  const [levelName, setLevelName] = useState("");
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);

  const levels = screens.filter(s => !s.type || s.type === "level");
  const availableScreens = screens.filter(s => s.type !== "level");

  const toggleScreen = (id: string) => {
    setSelectedScreens(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const handleCreateLevel = () => {
    if (!levelName.trim() || selectedScreens.length === 0) return;

    onAddLevel(levelName.trim(), selectedScreens);

    // reset
    setLevelName("");
    setSelectedScreens([]);
  };

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      
      {/* Main Level Grid */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-primary mb-3">
          Levels ({levels.length})
        </h3>

        {levels.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-6">
            No levels found.<br />
            (Try adding one on the right →)
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {levels.map(level => (
              <div
                key={level.id}
                onClick={() => onSelectLevel?.(level)}
                className="rounded border border-border p-2 hover:border-primary cursor-pointer transition"
              >
                {/* Level Name */}
                <div className="text-sm font-semibold truncate mb-1">
                  {level.name}
                </div>

                {/* Thumbnail */}
                <div className="w-full aspect-[4/3] bg-muted rounded overflow-hidden flex items-center justify-center">
                  {level.thumbnail ? (
                    <img
                      src={level.thumbnail}
                      className="w-full h-full object-contain pixelated"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No Preview
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Right Column: Add Level */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-bold text-primary">
          Add Level
        </h3>

        {/* Level Name Input */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Level Name
          </label>
          <Input
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            placeholder="e.g. Cavern Entrance"
          />
        </div>

        {/* Screen Picker */}
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            Select Screens
          </div>

          <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
            {availableScreens.map(screen => {
              const selected = selectedScreens.includes(screen.id);

              return (
                <div
                  key={screen.id}
                  onClick={() => toggleScreen(screen.id)}
                  className={`flex items-center justify-between rounded border p-2 cursor-pointer text-sm transition
                    ${selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary"}
                  `}
                >
                  <span className="truncate">
                    {screen.name}
                  </span>

                  {selected && (
                    <span className="text-xs font-semibold text-primary">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Button */}
        <Button
          onClick={handleCreateLevel}
          disabled={!levelName.trim() || selectedScreens.length === 0}
          className="w-full"
        >
          Create Level
        </Button>
      </Card>
    </div>
  );
}
