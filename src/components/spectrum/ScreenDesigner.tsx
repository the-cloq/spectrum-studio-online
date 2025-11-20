"use client";

import { useEffect, useRef, useState } from "react";
import { Screen, ScreenType } from "@/types/spectrum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface ScreenDesignerProps {
  screens: Screen[];
  currentScreenId: string | null;
  setCurrentScreenId: (id: string) => void;
  addScreen: (screen: Screen) => void;
  deleteScreen: (id: string) => void;
  updateScreen: (screen: Screen) => void;
}

export default function ScreenDesigner({
  screens,
  currentScreenId,
  setCurrentScreenId,
  addScreen,
  deleteScreen,
  updateScreen
}: ScreenDesignerProps) {

  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<ScreenType>("level");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentScreen = screens.find(s => s.id === currentScreenId);

  // 🎨 Paint screen onto canvas
  useEffect(() => {
    if (!canvasRef.current || !currentScreen) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tileSize = 16;

    canvas.width = currentScreen.width * tileSize;
    canvas.height = currentScreen.height * tileSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    currentScreen.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (!tile) return;
        ctx.fillStyle = "#000";
        ctx.fillRect(
          x * tileSize,
          y * tileSize,
          tileSize,
          tileSize
        );
      });
    });

  }, [currentScreen]);

  // 📸 Generate thumbnail after screen change
  const generateThumbnail = () => {
    if (!canvasRef.current || !currentScreen) return;

    const thumb = canvasRef.current.toDataURL("image/png");

    updateScreen({
      ...currentScreen,
      thumbnail: thumb
    });
  };

  // ➕ Add Screen
  const handleAddScreen = () => {
    if (!newScreenName.trim()) return;

    const newScreen: Screen = {
      id: crypto.randomUUID(),
      name: newScreenName,
      type: newScreenType,
      width: 32,
      height: 24,
      tiles: Array.from({ length: 24 }, () => Array(32).fill(""))
    };

    addScreen(newScreen);
    setCurrentScreenId(newScreen.id);
    setNewScreenName("");
  };

  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">

      {/* LEFT MAIN DESIGN AREA */}
      <div className="space-y-4">

        {/* Screen Toolbar */}
        <div className="flex items-center gap-2">
          <Input
            value={newScreenName}
            onChange={(e) => setNewScreenName(e.target.value)}
            placeholder="New screen name..."
          />

          <Select value={newScreenType} onValueChange={(v) => setNewScreenType(v as ScreenType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="level">Level</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="game">Game</SelectItem>
              <SelectItem value="gameover">Game Over</SelectItem>
              <SelectItem value="controls">Controls</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleAddScreen}>Add Screen</Button>
        </div>

        {/* Screen Info */}
        {currentScreen && (
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">{currentScreen.name}</h2>

            <Button variant="outline" onClick={generateThumbnail}>
              Generate Thumbnail
            </Button>
          </div>
        )}

        {/* Canvas */}
        <div className="border bg-black rounded overflow-hidden p-2">
          {currentScreen ? (
            <canvas ref={canvasRef} className="image-rendering-pixelated" />
          ) : (
            <p className="text-sm text-muted-foreground p-4">
              Select or create a screen to start designing.
            </p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-4">

        {/* Screens */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-primary">Screens</h3>
          </div>

          <div className="space-y-2">
            {screens.map(screen => (
              <div
                key={screen.id}
                onClick={() => setCurrentScreenId(screen.id)}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                  currentScreenId === screen.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  {screen.thumbnail ? (
                    <img
                      src={screen.thumbnail}
                      className="w-8 h-8 object-contain border"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted flex items-center justify-center text-xs">
                      ?
                    </div>
                  )}

                  <span className="text-sm truncate">{screen.name}</span>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteScreen(screen.id)}
                >
                  🗑
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Block Palette */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-bold text-primary mb-3">Block Palette</h3>
          <div className="grid grid-cols-3 gap-2">

            <button className="aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary border-border">
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                F
              </div>
            </button>

            <button className="aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary border-border">
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                W
              </div>
            </button>

            <button className="aspect-square bg-muted rounded border-2 p-1 transition-all hover:border-primary border-border">
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                S
              </div>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
