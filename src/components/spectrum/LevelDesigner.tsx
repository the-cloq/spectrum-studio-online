import React, { useState, useRef, useEffect } from "react";
import { Reorder } from "framer-motion";
import { Grip, Plus, Trash2, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Level, type Screen, type Block } from "@/types/spectrum";

// Safe screen preview component
const ScreenPreview = ({
  screen,
  blocks,
  width = 256,
  height = 192,
}: {
  screen: Screen;
  blocks: Block[];
  width?: number;
  height?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!screen || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const scaleX = width / screen.width;
    const scaleY = height / screen.height;

    screen.tiles?.forEach((row, y) => {
      row?.forEach((blockId, x) => {
        if (!blockId) return;
        const block = blocks.find((b) => b.id === blockId);
        if (!block?.sprite) return;

        const sprite = block.sprite;
        const [spriteWidth, spriteHeight] = sprite.size.split("x").map(Number);
        const pixelScaleX = scaleX / (spriteWidth / 8);
        const pixelScaleY = scaleY / (spriteHeight / 8);

        sprite.pixels?.forEach((rowPixels, py) => {
          rowPixels?.forEach((colorIndex, px) => {
            if (colorIndex === 0) return;
            const spectrumColors = [
              "#000000","#0000D7","#D70000","#D700D7",
              "#00D700","#00D7D7","#D7D700","#D7D7D7",
              "#000000","#0000FF","#FF0000","#FF00FF",
              "#00FF00","#00FFFF","#FFFF00","#FFFFFF"
            ];
            const color = spectrumColors[colorIndex] || "#000000";
            ctx.fillStyle = color;
            ctx.fillRect(
              x * scaleX + px * pixelScaleX,
              y * scaleY + py * pixelScaleY,
              pixelScaleX,
              pixelScaleY
            );
          });
        });
      });
    });
  }, [screen, blocks, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full bg-gray-900" />;
};

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  blocks: Block[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner: React.FC<LevelDesignerProps> = ({ levels, screens, blocks, onLevelsChange }) => {
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [newLevelName, setNewLevelName] = useState("");
  const [levelScreenAssignments, setLevelScreenAssignments] = useState<Record<string, string[]>>({});

  // Carousel state per level card
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});

  const handleCreateLevel = () => {
    if (!newLevelName.trim()) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: [],
    };
    onLevelsChange([...levels, newLevel]);
    setSelectedLevel(newLevel);
    setNewLevelName("");
  };

  const handleDeleteLevel = (levelId: string) => {
    const updatedLevels = levels.filter((l) => l.id !== levelId);
    onLevelsChange(updatedLevels);
    if (selectedLevel?.id === levelId) setSelectedLevel(updatedLevels[0] || null);
  };

  const screensForLevel = (level: Level) =>
    level.screenIds?.map((id) => screens.find((s) => s.id === id)).filter(Boolean) as Screen[];

  const handleCarouselPrev = (levelId: string) => {
    setCarouselIndex((prev) => ({
      ...prev,
      [levelId]: ((prev[levelId] || 0) - 1 + (selectedLevel?.screenIds.length || 1)) % (selectedLevel?.screenIds.length || 1),
    }));
  };

  const handleCarouselNext = (levelId: string) => {
    setCarouselIndex((prev) => ({
      ...prev,
      [levelId]: ((prev[levelId] || 0) + 1) % (selectedLevel?.screenIds.length || 1),
    }));
  };

  return (
    <div className="p-4">
      {/* Create Level */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newLevelName}
          onChange={(e) => setNewLevelName(e.target.value)}
          placeholder="Level Name..."
          className="border rounded px-2 py-1"
        />
        <Button onClick={handleCreateLevel} disabled={!newLevelName.trim()}>
          <Plus /> Create Level
        </Button>
      </div>

      {/* Levels Grid */}
      <Reorder.Group
        axis="y"
        values={levels}
        onReorder={onLevelsChange}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      >
        {levels.map((level, index) => {
          const screensForThisLevel = screensForLevel(level);
          const currentScreenIndex = carouselIndex[level.id] || 0;
          const currentScreen = screensForThisLevel[currentScreenIndex];

          return (
            <Reorder.Item key={level.id} value={level} className="relative">
              <Card className="relative overflow-hidden group border border-gray-600">
                {/* Drag handle */}
                <div className="absolute top-2 left-2 z-10 cursor-grab">
                  <Grip />
                </div>

                {/* Level number pill */}
                <div className="absolute top-2 right-2 bg-primary text-white px-2 py-0.5 rounded-full text-xs font-bold z-10">
                  {index + 1}
                </div>

                {/* Carousel */}
                <div className="relative">
                  {currentScreen && <ScreenPreview screen={currentScreen} blocks={blocks} />}
                  {/* Hover arrows */}
                  <button
                    onClick={() => handleCarouselPrev(level.id)}
                    className="absolute top-1/2 left-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 text-white p-1 rounded"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => handleCarouselNext(level.id)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 text-white p-1 rounded"
                  >
                    <ChevronRight size={16} />
                  </button>

                  {/* Screen name/type pill */}
                  {currentScreen && (
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                      {currentScreen.name} ({currentScreen.type})
                    </div>
                  )}
                </div>

                {/* Level name */}
                <div className="p-2 font-bold text-sm">{level.name}</div>

                {/* Delete button */}
                <div className="absolute top-2 right-10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLevel(level.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
};
