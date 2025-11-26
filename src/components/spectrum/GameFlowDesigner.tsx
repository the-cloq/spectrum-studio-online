import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { type Screen, type GameFlowScreen } from "@/types/spectrum";
import { toast } from "sonner";
import { Grip, X, Settings2, Plus, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface GameFlowDesignerProps {
  screens: Screen[];
  gameFlow: GameFlowScreen[];
  onGameFlowChange: (gameFlow: GameFlowScreen[]) => void;
}

export const GameFlowDesigner = ({ screens, gameFlow, onGameFlowChange }: GameFlowDesignerProps) => {
  const [selectedFlowScreen, setSelectedFlowScreen] = useState<GameFlowScreen | null>(null);
  const [draggedScreenId, setDraggedScreenId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "loading" | "title" | "instructions" | "controls" | "scoreboard" | "gameover">("all");

  // Filter non-game screens
  const nonGameScreens = screens.filter(s => s.type !== "game");

  // Filter by category
  const filteredScreens = categoryFilter === "all" 
    ? nonGameScreens 
    : nonGameScreens.filter(s => s.type === categoryFilter);

  // Screens already in game flow
  const flowScreenIds = new Set(gameFlow.map(f => f.screenId));
  const availableScreens = filteredScreens.filter(s => !flowScreenIds.has(s.id));

  const handleDragStart = (screenId: string) => {
    setDraggedScreenId(screenId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedScreenId) return;

    const screen = screens.find(s => s.id === draggedScreenId);
    if (!screen) return;

    // Loading screens must come first
    if (screen.type === "loading") {
      const loadingCount = gameFlow.filter(f => {
        const s = screens.find(sc => sc.id === f.screenId);
        return s?.type === "loading";
      }).length;

      const newFlow: GameFlowScreen = {
        screenId: draggedScreenId,
        order: loadingCount,
        autoShow: true,
      };

      onGameFlowChange([...gameFlow, newFlow]);
    } else {
      // Non-loading screens go after all loading screens
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
        screenId: draggedScreenId,
        order: maxLoadingOrder + 1 + (gameFlow.length - (maxLoadingOrder + 1)),
        accessKey: undefined,
        scrollText: screen.name,
      };

      onGameFlowChange([...gameFlow, newFlow]);
    }

    setDraggedScreenId(null);
    toast.success(`${screen.name} added to Game Flow`);
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

  // Sort game flow by order
  const sortedGameFlow = [...gameFlow].sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Sidebar - Screen Library */}
      <Card className="p-4 lg:col-span-1">
        <h3 className="font-bold text-lg mb-4">Screen Library</h3>
        
        <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)} className="mb-4">
          <TabsList className="grid grid-cols-2 h-auto">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="loading" className="text-xs">Loading</TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-3 h-auto mt-1">
            <TabsTrigger value="instructions" className="text-xs">Instructions</TabsTrigger>
            <TabsTrigger value="controls" className="text-xs">Controls</TabsTrigger>
            <TabsTrigger value="scoreboard" className="text-xs">Score</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {availableScreens.length === 0 ? (
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
                  onDragStart={() => handleDragStart(screen.id)}
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
                            
                            // Clear background
                            ctx.fillStyle = "#000";
                            ctx.fillRect(0, 0, 256, 192);
                            
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
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Area - Game Flow Grid */}
      <Card className="p-6 lg:col-span-2">
        <h3 className="font-bold text-lg mb-4">Game Flow Sequence</h3>
        
        {gameFlow.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center"
          >
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Create Your Game Flow</h3>
            <p className="text-muted-foreground mb-4">
              Drag screens from the library to organize your game's non-playable screens
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Loading screens must always appear first
            </p>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {sortedGameFlow.map((flowScreen) => {
              const screen = screens.find(s => s.id === flowScreen.screenId);
              if (!screen) return null;

              const isLoading = screen.type === "loading";
              const isSelected = selectedFlowScreen?.screenId === flowScreen.screenId;

              return (
                <Card
                  key={flowScreen.screenId}
                  className={`p-4 transition-all ${
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
                        <h4 className="font-semibold text-sm">{screen.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mb-2">
                        {screen.type}
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
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Menu Navigation</h4>
            <p className="text-xs text-muted-foreground">
              Game flow will use continuous loop scrolling text menu for navigation between screens.
            </p>
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
