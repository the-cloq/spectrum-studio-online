import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Trash2, Grip, Edit, Play, X, ZoomIn, ZoomOut } from "lucide-react";
import { type Level, type Screen, type Block, type GameObject, type Sprite, SPECTRUM_COLORS } from "@/types/spectrum";

interface LevelDesignerProps {
  levels: Level[];
  screens: Screen[];
  blocks: Block[];
  objects: GameObject[];
  sprites: Sprite[];
  onLevelsChange: (levels: Level[]) => void;
}

export const LevelDesigner = ({ levels, screens, blocks, objects, sprites, onLevelsChange }: LevelDesignerProps) => {
  const [newLevelName, setNewLevelName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [screenIndices, setScreenIndices] = useState<Record<string, number>>({});
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [playingLevelId, setPlayingLevelId] = useState<string | null>(null);
  const [canvasZoomIndex, setCanvasZoomIndex] = useState(1); // 0=256x192, 1=512x384, 2=768x576
  const playCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);

  // Drag & Drop
  const handleDragStart = (index: number) => setDraggingIndex(index);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setHoveredIndex(index);
  };
  const handleDragEnd = () => {
    if (draggingIndex === null || hoveredIndex === null || draggingIndex === hoveredIndex) {
      setDraggingIndex(null);
      setHoveredIndex(null);
      return;
    }
    const reordered = [...levels];
    const [moved] = reordered.splice(draggingIndex, 1);
    reordered.splice(hoveredIndex, 0, moved);
    onLevelsChange(reordered);
    setDraggingIndex(null);
    setHoveredIndex(null);
  };

  // Carousel
  const nextScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) + 1) % screensForLevel.length
    }));
  };

  const prevScreen = (levelId: string, screensForLevel: Screen[]) => {
    setScreenIndices(prev => ({
      ...prev,
      [levelId]: ((prev[levelId] ?? 0) - 1 + screensForLevel.length) % screensForLevel.length
    }));
  };

  const handleDeleteLevel = (id: string) => {
    onLevelsChange(levels.filter(l => l.id !== id));
  };

  const handleCreateLevel = () => {
    if (!newLevelName.trim() || selectedScreenIds.length === 0) return;

    const newLevel: Level = {
      id: `level-${Date.now()}`,
      name: newLevelName,
      screenIds: selectedScreenIds
    };
    onLevelsChange([...levels, newLevel]);
    setNewLevelName("");
    setSelectedScreenIds([]);
  };

  const handleEditLevel = (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      setEditingLevelId(levelId);
      setSelectedScreenIds(level.screenIds);
    }
  };

  const handleSaveEdit = () => {
    if (!editingLevelId) return;
    const updatedLevels = levels.map(l =>
      l.id === editingLevelId ? { ...l, screenIds: selectedScreenIds } : l
    );
    onLevelsChange(updatedLevels);
    setEditingLevelId(null);
    setSelectedScreenIds([]);
  };

  const handleCancelEdit = () => {
    setEditingLevelId(null);
    setSelectedScreenIds([]);
  };

  const handlePlayLevel = (levelId: string) => {
    setPlayingLevelId(levelId);
  };

  const handleClosePlay = () => {
    setPlayingLevelId(null);
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  };

  const canvasZoomSizes = [
    { width: 256, height: 192 },
    { width: 512, height: 384 },
    { width: 768, height: 576 }
  ];

  // Game loop for playing level
  useEffect(() => {
    if (!playingLevelId || !playCanvasRef.current) return;

    const canvas = playCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const level = levels.find(l => l.id === playingLevelId);
    if (!level || level.screenIds.length === 0) return;

    const currentScreenId = level.screenIds[0];
    const currentScreen = screens.find(s => s.id === currentScreenId);
    if (!currentScreen) return;

    // Player state
    let playerX = 32;
    let playerY = 160;
    let playerVelX = 0;
    let playerVelY = 0;
    let isJumping = false;
    let frameCount = 0;
    let animFrame = 0;
    const keys: Record<string, boolean> = {};

    // Find player object on screen
    const playerPlaced = currentScreen.placedObjects?.find(po => {
      const obj = objects.find(o => o.id === po.objectId);
      return obj?.type === "player";
    });

    if (playerPlaced) {
      playerX = playerPlaced.x * 8;
      playerY = playerPlaced.y * 8;
    }

    const playerObj = playerPlaced ? objects.find(o => o.id === playerPlaced.objectId) : null;
    const playerSprite = playerObj ? sprites.find(s => s.id === playerObj.spriteId) : null;

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const gameLoop = () => {
      frameCount++;

      // Clear canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 256, 192);

      // Render screen tiles/blocks
      if (currentScreen.type === "game" && currentScreen.tiles) {
        for (let row = 0; row < 12; row++) {
          for (let col = 0; col < 16; col++) {
            const blockId = currentScreen.tiles[row]?.[col];
            if (blockId) {
              const block = blocks.find(b => b.id === blockId);
              if (block?.sprite?.frames?.[0]?.pixels) {
                for (let y = 0; y < 16; y++) {
                  for (let x = 0; x < 16; x++) {
                    const colorIndex = block.sprite.frames[0].pixels[y]?.[x];
                    if (colorIndex !== undefined && colorIndex !== 0) {
                      ctx.fillStyle = SPECTRUM_COLORS[colorIndex]?.value || "#fff";
                      ctx.fillRect(col * 16 + x, row * 16 + y, 1, 1);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Player physics
      if (playerObj && playerSprite) {
        const speed = playerObj.properties.speed || 2;
        const gravity = 0.5;
        const jumpPower = -8;

        // Horizontal movement
        if (keys["arrowleft"] || keys["a"]) {
          playerVelX = -speed;
        } else if (keys["arrowright"] || keys["d"]) {
          playerVelX = speed;
        } else {
          playerVelX = 0;
        }

        // Jump
        if ((keys[" "] || keys["arrowup"] || keys["w"]) && !isJumping) {
          playerVelY = jumpPower;
          isJumping = true;
        }

        // Apply gravity
        playerVelY += gravity;

        // Update position
        playerX += playerVelX;
        playerY += playerVelY;

        // Ground collision (simple floor at y=176 for 16px sprite)
        if (playerY >= 176) {
          playerY = 176;
          playerVelY = 0;
          isJumping = false;
        }

        // Bounds
        if (playerX < 0) playerX = 0;
        if (playerX > 256 - 16) playerX = 256 - 16;

        // Animate sprite
        if (frameCount % 6 === 0 && (keys["arrowleft"] || keys["arrowright"] || keys["a"] || keys["d"])) {
          animFrame = (animFrame + 1) % (playerSprite.frames.length || 1);
        }

        // Render player sprite
        const frame = playerSprite.frames[animFrame] || playerSprite.frames[0];
        if (frame?.pixels) {
          const spriteSize = playerSprite.size.split("x").map(Number);
          const spriteWidth = spriteSize[0] || 16;
          const spriteHeight = spriteSize[1] || 16;
          
          for (let y = 0; y < spriteHeight; y++) {
            for (let x = 0; x < spriteWidth; x++) {
              const colorIndex = frame.pixels[y]?.[x];
              if (colorIndex !== undefined && colorIndex !== 0) {
                ctx.fillStyle = SPECTRUM_COLORS[colorIndex]?.value || "#fff";
                ctx.fillRect(playerX + x, playerY + y, 1, 1);
              }
            }
          }
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [playingLevelId, levels, screens, blocks, objects, sprites]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Left/Main Panel: Level Cards */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 lg:col-span-3">
        <h2 className="text-lg font-bold text-primary mb-4">Levels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {levels.map((level, index) => {
            const screensForLevel = level.screenIds
              .map(id => screens.find(s => s.id === id))
              .filter(Boolean) as Screen[];

            const currentScreenIndex = screenIndices[level.id] ?? 0;

            return (
              <Card
                key={level.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative p-4 border rounded flex flex-col gap-2 cursor-move group ${
                  draggingIndex === index ? "opacity-50" : ""
                }`}
              >
                {/* Top Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span>{level.name}</span>
                  </div>
                  <Badge>{index + 1}</Badge>
                </div>

                {/* Screen Carousel */}
                {screensForLevel.length > 0 ? (
                  <div className="relative w-full pt-[75%] bg-muted rounded overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <canvas
                        width={256}
                        height={192}
                        className="w-full h-full bg-gray-900"
                        ref={canvas => {
                          if (!canvas || !screensForLevel[currentScreenIndex]) return;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;
                          
                          const screen = screensForLevel[currentScreenIndex];
                          
                          // Clear background
                          ctx.fillStyle = "#000";
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          
                          // Render screen content
                          if (screen.type === "title" && screen.pixels) {
                            // Render title screen pixels
                            for (let y = 0; y < 192; y++) {
                              for (let x = 0; x < 256; x++) {
                                const color = screen.pixels[y]?.[x];
                                if (color) {
                                  ctx.fillStyle = color.value;
                                  ctx.fillRect(x, y, 1, 1);
                                }
                              }
                            }
                          } else if (screen.type === "game" && screen.tiles) {
                            // Render game screen tiles
                            const blockSize = 16;
                            for (let row = 0; row < 12; row++) {
                              for (let col = 0; col < 16; col++) {
                                const blockId = screen.tiles[row]?.[col];
                                if (blockId) {
                                  const block = blocks.find(b => b.id === blockId);
                                  if (block?.sprite?.frames?.[0]?.pixels) {
                                    // Render block sprite
                                    for (let y = 0; y < 16; y++) {
                                      for (let x = 0; x < 16; x++) {
                                        const colorIndex = block.sprite.frames[0].pixels[y]?.[x];
                                        if (colorIndex !== undefined && colorIndex !== 0) {
                                          ctx.fillStyle = `hsl(${colorIndex * 30}, 70%, 50%)`;
                                          ctx.fillRect(col * blockSize + x, row * blockSize + y, 1, 1);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }}
                      />
                      {screensForLevel.length > 1 && (
                        <>
                          <button
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); prevScreen(level.id, screensForLevel); }}
                          >
                            ◀
                          </button>
                          <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); nextScreen(level.id, screensForLevel); }}
                          >
                            ▶
                          </button>
                        </>
                      )}
                      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                        {screensForLevel[currentScreenIndex].name} ({screensForLevel[currentScreenIndex].type || 'game'})
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full pt-[75%] bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                    No screens
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditLevel(level.id)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePlayLevel(level.id)}
                    className="flex-1"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteLevel(level.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {/* Right Panel: Add/Edit Level */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4 max-h-screen flex flex-col">
        <h3 className="text-sm font-bold text-primary mb-2">
          {editingLevelId ? "Edit Level" : "Add Level"}
        </h3>
        {!editingLevelId && (
          <Input
            value={newLevelName}
            onChange={e => setNewLevelName(e.target.value)}
            placeholder="Level name"
          />
        )}
        <div className="space-y-1 overflow-auto max-h-full flex-1">
          <h4 className="text-sm font-bold text-primary mb-2">Include Screens</h4>
          {screens.map(screen => (
            <label
              key={screen.id}
              className="flex items-center justify-between p-2 rounded border cursor-pointer transition-all border-border hover:border-primary/50"
            >
              <span className="text-sm truncate">{screen.name}</span>
              <Checkbox
                checked={selectedScreenIds.includes(screen.id)}
                onCheckedChange={checked => {
                  if (checked) {
                    setSelectedScreenIds([...selectedScreenIds, screen.id]);
                  } else {
                    setSelectedScreenIds(selectedScreenIds.filter(id => id !== screen.id));
                  }
                }}
              />
            </label>
          ))}
        </div>
        {editingLevelId ? (
          <div className="flex gap-2">
            <Button onClick={handleCancelEdit} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="flex-1">
              Save
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleCreateLevel}
            disabled={!newLevelName.trim() || selectedScreenIds.length === 0}
            className="w-full"
          >
            Add Level
          </Button>
        )}
      </Card>

      {/* Play Level Drawer */}
      <Drawer open={!!playingLevelId} onOpenChange={(open) => !open && handleClosePlay()}>
        <DrawerContent className="h-screen w-[90vw] sm:w-[850px] ml-auto">
          <DrawerHeader className="flex items-center justify-between border-b">
            <DrawerTitle>
              Play Level: {levels.find(l => l.id === playingLevelId)?.name}
            </DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCanvasZoomIndex((canvasZoomIndex - 1 + 3) % 3)}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {canvasZoomSizes[canvasZoomIndex].width}×{canvasZoomSizes[canvasZoomIndex].height}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCanvasZoomIndex((canvasZoomIndex + 1) % 3)}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 flex items-center justify-center p-8 bg-muted/20">
            <div className="border-4 border-border rounded-lg overflow-hidden shadow-2xl">
              <canvas
                ref={playCanvasRef}
                width={256}
                height={192}
                style={{
                  width: canvasZoomSizes[canvasZoomIndex].width,
                  height: canvasZoomSizes[canvasZoomIndex].height,
                  imageRendering: "pixelated"
                }}
                className="bg-black"
              />
            </div>
          </div>
          <div className="border-t p-4 bg-card">
            <p className="text-sm text-muted-foreground text-center">
              Use Arrow Keys or WASD to move • Space/W/Up to jump
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
