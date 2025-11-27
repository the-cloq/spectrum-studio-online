import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { type Screen, type GameFlowScreen, type Block, type Level, type GameObject, type Sprite, SPECTRUM_COLORS } from "@/types/spectrum";
import { toast } from "sonner";
import { Grip, X, Settings2, Plus, AlertCircle, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { exportGameFlowToTAP, downloadGameFlowTAP } from "@/lib/gameFlowExport";

interface GameFlowDesignerProps {
  screens: Screen[];
  blocks: Block[];
  levels: Level[];
  objects: GameObject[];
  sprites: Sprite[];
  gameFlow: GameFlowScreen[];
  onGameFlowChange: (gameFlow: GameFlowScreen[]) => void;
  projectName: string;
}

export const GameFlowDesigner = ({ screens, blocks, levels, objects, sprites, gameFlow, onGameFlowChange, projectName }: GameFlowDesignerProps) => {
  const [selectedFlowScreen, setSelectedFlowScreen] = useState<GameFlowScreen | null>(null);
  const [draggedScreenId, setDraggedScreenId] = useState<string | null>(null);
  const [draggedFlowIndex, setDraggedFlowIndex] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "loading" | "title" | "instructions" | "controls" | "scoreboard" | "gameover" | "levels">("all");
  const [flowFilter, setFlowFilter] = useState<"all" | "loading" | "system" | "levels">("all");

  // Filter screens based on category
  const filteredScreens = screens.filter(s => {
    if (categoryFilter === "all") return s.type !== "game"; // Exclude game screens from "all"
    if (categoryFilter === "levels") return false; // Don't show screens in levels tab
    if (categoryFilter === "title") return ["title", "instructions", "controls", "gameover", "scoreboard"].includes(s.type);
    return s.type === categoryFilter;
  });

  // Screens already in game flow
  const flowScreenIds = new Set(gameFlow.map(f => f.screenId));
  const flowLevelIds = new Set(gameFlow.map(f => f.levelId).filter(Boolean));
  const availableScreens = filteredScreens.filter(s => !flowScreenIds.has(s.id));
  const availableLevels = levels.filter(l => !flowLevelIds.has(l.id));

  const handleDragStart = (e: React.DragEvent, id: string, isLevel: boolean = false) => {
    setDraggedScreenId(id);
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", isLevel ? `level:${id}` : id);
    } catch {
      // dataTransfer may not be available in some environments; ignore
    }
  };

  const addToFlow = (id: string, isLevel: boolean = false) => {
    if (isLevel) {
      const level = levels.find(l => l.id === id);
      if (!level) return;

      if (flowLevelIds.has(id)) {
        toast.error("Level is already in Game Flow");
        setDraggedScreenId(null);
        return;
      }

      const maxLoadingOrder = Math.max(
        -1,
        ...gameFlow
          .filter(f => {
            const s = screens.find(sc => sc.id === f.screenId);
            return s?.type === "loading";
          })
          .map(f => f.order)
      );

      const newFlow: GameFlowScreen = {
        levelId: id,
        screenId: level.screenIds[0] || "",
        order: maxLoadingOrder + 1 + (gameFlow.length - (maxLoadingOrder + 1)),
        scrollText: level.name,
      };

      onGameFlowChange([...gameFlow, newFlow]);
      setDraggedScreenId(null);
      toast.success(`${level.name} added to Game Flow`);
    } else {
      const screen = screens.find(s => s.id === id);
      if (!screen) return;

      if (flowScreenIds.has(id)) {
        toast.error("Screen is already in Game Flow");
        setDraggedScreenId(null);
        return;
      }

      if (screen.type === "loading") {
        const loadingCount = gameFlow.filter(f => {
          const s = screens.find(sc => sc.id === f.screenId);
          return s?.type === "loading";
        }).length;

        const newFlow: GameFlowScreen = {
          screenId: id,
          order: loadingCount,
          autoShow: true,
        };

        onGameFlowChange([...gameFlow, newFlow]);
      } else {
        const maxLoadingOrder = Math.max(
          -1,
          ...gameFlow
            .filter(f => {
              const s = screens.find(sc => sc.id === f.screenId);
              return s?.type === "loading";
            })
            .map(f => f.order)
        );

        const newFlow: GameFlowScreen = {
          screenId: id,
          order: maxLoadingOrder + 1 + (gameFlow.length - (maxLoadingOrder + 1)),
          accessKey: undefined,
          scrollText: screen.name,
        };

        onGameFlowChange([...gameFlow, newFlow]);
      }

      setDraggedScreenId(null);
      toast.success(`${screen.name} added to Game Flow`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();

    // If we're reordering within the flow
    if (draggedFlowIndex !== null && targetIndex !== undefined) {
      const reordered = [...sortedGameFlow];
      const [removed] = reordered.splice(draggedFlowIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      
      // Update order property
      const updated = reordered.map((f, idx) => ({ ...f, order: idx }));
      onGameFlowChange(updated);
      setDraggedFlowIndex(null);
      toast.success("Screen reordered");
      return;
    }

    // Otherwise, adding from library
    let droppedData: string | null = null;
    try {
      const fromData = e.dataTransfer.getData("text/plain");
      droppedData = fromData || draggedScreenId;
    } catch {
      droppedData = draggedScreenId;
    }

    if (!droppedData) return;
    
    const isLevel = droppedData.startsWith("level:");
    const id = isLevel ? droppedData.replace("level:", "") : droppedData;
    addToFlow(id, isLevel);
    setDraggedFlowIndex(null);
  };
  const handleRemoveScreen = (screenId: string) => {
    const updatedFlow = gameFlow
      .filter(f => f.screenId !== screenId)
      .map((f, idx) => ({ ...f, order: idx }));
    
    onGameFlowChange(updatedFlow);
    
    if (selectedFlowScreen?.screenId === screenId) {
      setSelectedFlowScreen(null);
    }
    
    toast.success("Screen removed from Game Flow");
  };

  const handleSelectFlowScreen = (flowScreen: GameFlowScreen) => {
    setSelectedFlowScreen(flowScreen);
  };

  const handleUpdateFlowScreen = (updates: Partial<GameFlowScreen>) => {
    if (!selectedFlowScreen) return;

    const updatedFlow = gameFlow.map(f =>
      f.screenId === selectedFlowScreen.screenId ? { ...f, ...updates } : f
    );

    onGameFlowChange(updatedFlow);
    setSelectedFlowScreen({ ...selectedFlowScreen, ...updates });
    toast.success("Screen configuration updated");
  };

  const handleExportTAP = () => {
    try {
      const blob = exportGameFlowToTAP(gameFlow, screens, levels, blocks, objects, sprites, projectName);
      downloadGameFlowTAP(blob, projectName);
      toast.success("Game Flow exported to TAP file successfully!");
    } catch (error) {
      console.error("TAP export error:", error);
      toast.error("Failed to export TAP file");
    }
  };

  // Sort game flow by order
  const sortedGameFlow = [...gameFlow].sort((a, b) => a.order - b.order);
  
  // Apply flow filter
  const filteredGameFlow = sortedGameFlow.filter(flowScreen => {
    if (flowFilter === "all") return true;
    
    if (flowFilter === "levels") return !!flowScreen.levelId;
    
    const screen = screens.find(s => s.id === flowScreen.screenId);
    if (!screen) return false;
    
    if (flowFilter === "loading") return screen.type === "loading";
    if (flowFilter === "system") return ["title", "instructions", "controls", "gameover"].includes(screen.type);
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Sidebar - Screen Library */}
      <Card className="p-4 lg:col-span-1">
        <h3 className="font-bold text-lg mb-4">Screen Library</h3>
        
        <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)} className="mb-4">
          <TabsList className="grid grid-cols-4 h-auto">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="loading" className="text-xs">Loading</TabsTrigger>
            <TabsTrigger value="title" className="text-xs">System</TabsTrigger>
            <TabsTrigger value="levels" className="text-xs">Levels</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {categoryFilter === "levels" ? (
              // Show levels when Levels tab is active
              availableLevels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available levels. Create levels in the Levels section first.
                </p>
              ) : (
                availableLevels.map(level => {
                  const levelScreen = screens.find(s => s.id === level.screenIds[0]);
                  return (
                    <Card
                      key={level.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, level.id, true)}
                      onClick={() => addToFlow(level.id, true)}
                      className="p-3 cursor-move hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Grip className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm mb-1">{level.name}</p>
                          <p className="text-xs text-muted-foreground mb-2">Level</p>
                          {/* Level preview thumbnail */}
                          <div className="w-full aspect-[4/3] bg-muted rounded overflow-hidden">
                            <canvas
                              width={256}
                              height={192}
                              className="w-full h-full"
                              ref={canvas => {
                                if (!canvas) return;
                                const ctx = canvas.getContext("2d");
                                if (!ctx) return;
                                const levelScreen = screens.find(s => s.id === level.screenIds[0]);
                                if (!levelScreen) return;
                                
                                ctx.fillStyle = "#000";
                                ctx.fillRect(0, 0, 256, 192);
                                
                                if (levelScreen.tiles) {
                                  const GRID_WIDTH = 32;
                                  const GRID_HEIGHT = 24;
                                  const BLOCK_SIZE = 8;
                                  
                                  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
                                    for (let gx = 0; gx < GRID_WIDTH; gx++) {
                                      const blockId = levelScreen.tiles[gy]?.[gx];
                                      if (blockId) {
                                        const block = blocks.find(b => b.id === blockId);
                                        if (block?.sprite?.frames?.[0]?.pixels) {
                                          for (let by = 0; by < BLOCK_SIZE; by++) {
                                            for (let bx = 0; bx < BLOCK_SIZE; bx++) {
                                              const colorIndex = block.sprite.frames[0].pixels[by]?.[bx];
                                              if (colorIndex !== undefined && colorIndex !== 0) {
                                                const color = SPECTRUM_COLORS[colorIndex]?.value || "#fff";
                                                ctx.fillStyle = color;
                                                ctx.fillRect(gx * BLOCK_SIZE + bx, gy * BLOCK_SIZE + by, 1, 1);
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
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )
            ) : (
              // Show screens for other tabs
              availableScreens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {categoryFilter === "all" 
                    ? "No available screens. All screens are in Game Flow or create new screens first." 
                    : `No ${categoryFilter} screens available`}
                </p>
              ) : (
                availableScreens.map(screen => (
                  <Card
                    key={screen.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, screen.id, false)}
                    onClick={() => addToFlow(screen.id, false)}
                    className="p-3 cursor-move hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Grip className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{screen.name}</p>
                        <p className="text-xs text-muted-foreground capitalize mb-2">{screen.type}</p>
                        {/* Screen preview thumbnail */}
                        <div className="w-full aspect-[4/3] bg-muted rounded overflow-hidden">
                          <canvas
                            width={256}
                            height={192}
                            className="w-full h-full"
                            ref={canvas => {
                              if (!canvas) return;
                              const ctx = canvas.getContext("2d");
                              if (!ctx) return;
                              
                              ctx.fillStyle = "#000";
                              ctx.fillRect(0, 0, 256, 192);
                              
                              if ((screen.type === "title" || screen.type === "loading") && screen.pixels) {
                                for (let y = 0; y < 192; y++) {
                                  for (let x = 0; x < 256; x++) {
                                    const color = screen.pixels[y]?.[x];
                                    if (color) {
                                      ctx.fillStyle = color.value;
                                      ctx.fillRect(x, y, 1, 1);
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Area - Game Flow Grid */}
      <Card className="p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg">Game Flow Sequence</h3>
            <p className="text-xs text-muted-foreground">Organize screens and levels in your game</p>
          </div>
          <Button
            onClick={handleExportTAP}
            disabled={gameFlow.length === 0}
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export TAP
          </Button>
        </div>

        <Tabs value={flowFilter} onValueChange={(v) => setFlowFilter(v as any)} className="mb-4">
          <TabsList className="grid grid-cols-4 h-auto">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="loading" className="text-xs">Loading</TabsTrigger>
            <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
            <TabsTrigger value="levels" className="text-xs">Levels</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {gameFlow.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e)}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center min-h-[400px] flex flex-col items-center justify-center"
          >
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Create Your Game Flow</h3>
            <p className="text-muted-foreground mb-4">
              Drag or click screens from the library to organize your game's non-playable screens
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Loading screens must always appear first
            </p>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[200px]"
          >
            {filteredGameFlow.map((flowScreen) => {
              const index = sortedGameFlow.findIndex(f => f.screenId === flowScreen.screenId && f.levelId === flowScreen.levelId);
              
              const level = flowScreen.levelId ? levels.find(l => l.id === flowScreen.levelId) : null;
              const screen = level ? screens.find(s => s.id === level.screenIds[0]) : screens.find(s => s.id === flowScreen.screenId);
              if (!screen && !level) return null;
              
              const displayName = level ? level.name : screen?.name || "Unknown";
              const displayType = level ? "level" : screen?.type || "unknown";

              const isLoading = screen?.type === "loading";
              const isSelected = selectedFlowScreen?.screenId === flowScreen.screenId && selectedFlowScreen?.levelId === flowScreen.levelId;

              return (
                <Card
                  key={flowScreen.screenId}
                  draggable
                  onDragStart={(e) => {
                    setDraggedFlowIndex(index);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, index);
                  }}
                  className={`p-4 transition-all cursor-move ${
                    isSelected ? "ring-2 ring-primary" : "hover:border-primary"
                  } ${isLoading ? "border-l-4 border-l-blue-500" : ""}`}
                  onClick={() => handleSelectFlowScreen(flowScreen)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          #{flowScreen.order + 1}
                        </span>
                        <h4 className="font-semibold text-sm">{displayName}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mb-2">
                        {displayType}
                      </p>
                      
                      {/* Screen preview thumbnail */}
                      <div className="w-full aspect-[4/3] bg-muted rounded overflow-hidden mb-2">
                        <canvas
                          width={256}
                          height={192}
                          className="w-full h-full"
                          ref={canvas => {
                            if (!canvas) return;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) return;
                            
                            // Clear background
                            ctx.fillStyle = "#000";
                            ctx.fillRect(0, 0, 256, 192);
                            
                            // Render screen content based on type
                            if ((screen?.type === "title" || screen?.type === "loading") && screen.pixels) {
                              // Render pixel-based screens (title/loading)
                              for (let y = 0; y < 192; y++) {
                                for (let x = 0; x < 256; x++) {
                                  const color = screen.pixels[y]?.[x];
                                  if (color) {
                                    ctx.fillStyle = color.value;
                                    ctx.fillRect(x, y, 1, 1);
                                  }
                                }
                              }
                            } else if (screen?.tiles || (screen?.type === "game" && screen.tiles)) {
                              // Render game screen with blocks
                              const GRID_WIDTH = 32;
                              const GRID_HEIGHT = 24;
                              const BLOCK_SIZE = 8;
                              
                              for (let gy = 0; gy < GRID_HEIGHT; gy++) {
                                for (let gx = 0; gx < GRID_WIDTH; gx++) {
                                  const blockId = screen.tiles[gy]?.[gx];
                                  if (blockId) {
                                    const block = blocks.find(b => b.id === blockId);
                                    if (block?.sprite?.frames?.[0]?.pixels) {
                                      for (let by = 0; by < BLOCK_SIZE; by++) {
                                        for (let bx = 0; bx < BLOCK_SIZE; bx++) {
                                          const colorIndex = block.sprite.frames[0].pixels[by]?.[bx];
                                          if (colorIndex !== undefined && colorIndex !== 0) {
                                            const color = SPECTRUM_COLORS[colorIndex]?.value || "#fff";
                                            ctx.fillStyle = color;
                                            ctx.fillRect(gx * BLOCK_SIZE + bx, gy * BLOCK_SIZE + by, 1, 1);
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
                      </div>
                      
                      {flowScreen.accessKey && (
                        <p className="text-xs text-green-600">
                          Access key: <kbd className="px-1.5 py-0.5 bg-muted rounded">{flowScreen.accessKey}</kbd>
                        </p>
                      )}
                      {flowScreen.autoShow && (
                        <p className="text-xs text-blue-600">Auto-show on start</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveScreen(flowScreen.screenId);
                      }}
                      className="h-6 w-6"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {gameFlow.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Menu Navigation</h4>
              <p className="text-xs text-muted-foreground">
                Set access keys for each screen. The game will show a scrolling menu at the bottom of title screens.
              </p>
            </div>
            
            <Button 
              onClick={handleExportTAP}
              className="w-full"
              disabled={gameFlow.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Game Flow as TAP
            </Button>
          </div>
        )}
      </Card>

      {/* Right Panel - Configuration */}
      <Card className="p-4 lg:col-span-1">
        {selectedFlowScreen ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Configure Screen</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedFlowScreen(null)}
                className="h-6 w-6"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  Screen Name
                </Label>
                <p className="text-sm text-muted-foreground">
                  {screens.find(s => s.id === selectedFlowScreen.screenId)?.name}
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  Screen Type
                </Label>
                <p className="text-sm text-muted-foreground capitalize">
                  {screens.find(s => s.id === selectedFlowScreen.screenId)?.type}
                </p>
              </div>

              <Separator />

              {screens.find(s => s.id === selectedFlowScreen.screenId)?.type !== "loading" && (
                <>
                  <div>
                    <Label htmlFor="access-key" className="text-sm font-semibold mb-2 block">
                      Access Key
                    </Label>
                    <Input
                      id="access-key"
                      placeholder="e.g., I, K, S"
                      maxLength={1}
                      value={selectedFlowScreen.accessKey || ""}
                      onChange={(e) => handleUpdateFlowScreen({ accessKey: e.target.value.toUpperCase() || undefined })}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Key to press to access this screen
                    </p>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="auto-show"
                      checked={selectedFlowScreen.autoShow || false}
                      onCheckedChange={(checked) => handleUpdateFlowScreen({ autoShow: checked as boolean })}
                    />
                    <div className="flex-1">
                      <Label htmlFor="auto-show" className="text-sm font-medium cursor-pointer">
                        Auto-show on start
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Display automatically when game starts
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="scroll-text" className="text-sm font-semibold mb-2 block">
                      Menu Scroll Text
                    </Label>
                    <Input
                      id="scroll-text"
                      placeholder="Text for menu navigation"
                      value={selectedFlowScreen.scrollText || ""}
                      onChange={(e) => handleUpdateFlowScreen({ scrollText: e.target.value })}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Text shown in continuous loop menu
                    </p>
                  </div>
                </>
              )}

              {screens.find(s => s.id === selectedFlowScreen.screenId)?.type === "loading" && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                  <p className="text-xs text-blue-600">
                    <strong>Loading screens</strong> always appear first in the sequence and are auto-shown.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a screen to configure its access settings</p>
          </div>
        )}
      </Card>
    </div>
  );
};
