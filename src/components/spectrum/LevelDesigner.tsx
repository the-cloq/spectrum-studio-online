import { Card } from "@/components/ui/card";
import { type Screen } from "@/types/spectrum";

interface LevelDesignerProps {
  screens: Screen[];
  onSelectScreen?: (screen: Screen) => void;
}

export function LevelDesigner({ screens, onSelectScreen }: LevelDesignerProps) {
  const levels = screens.filter(s => !s.type || s.type === "level");

  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-primary mb-3">
        Levels ({levels.length})
      </h3>

      {levels.length === 0 ? (
        <div className="text-muted-foreground text-sm text-center py-6">
          No levels found.<br />
          (Are your screens marked as type "level"?)
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {levels.map((level) => (
            <div
              key={level.id}
              onClick={() => onSelectScreen?.(level)}
              className="border border-border rounded p-2 cursor-pointer hover:border-primary transition"
            >
              <div className="text-sm font-semibold truncate">
                {level.name}
              </div>

              <div className="mt-2 w-full aspect-[4/3] bg-muted flex items-center justify-center">
                {level.thumbnail ? (
                  <img
                    src={level.thumbnail}
                    className="w-full h-full object-contain pixelated"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No Preview</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
