import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPalette } from "@/components/spectrum/ColorPalette";
import { LoadingScreenCreator } from "@/components/spectrum/LoadingScreenCreator";
import { SPECTRUM_COLORS, type SpectrumColor, type Screen, type Block, type GameObject, type PlacedObject } from "@/types/spectrum";
import { Plus, Trash2, Eraser, ZoomIn, ZoomOut, FlipHorizontal, Move } from "lucide-react";
import { toast } from "sonner";

interface ScreenDesignerProps {
  blocks: Block[];
  objects: GameObject[];
  sprites: any[]; // Add sprites array
  screens: Screen[];
  onScreensChange: (screens: Screen[]) => void;
}

const BASE_WIDTH = 256;
const BASE_HEIGHT = 192;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export const ScreenDesigner = ({ blocks, objects, sprites, screens, onScreensChange }: ScreenDesignerProps) => {

  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(screens[0] || null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedObject, setSelectedObject] = useState<GameObject | null>(null);
  const [selectedColor, setSelectedColor] = useState<SpectrumColor>(SPECTRUM_COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState<Screen["type"] | "">("");
  const [zoom, setZoom] = useState(2);
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>(selectedScreen?.placedObjects || []);
  const [selectedPlacedObject, setSelectedPlacedObject] = useState<PlacedObject | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [blockEditPanel, setBlockEditPanel] = useState<React.ReactNode>(null);

  // Load placed objects when screen changes
  useEffect(() => {
    setPlacedObjects(selectedScreen?.placedObjects || []);
    setSelectedPlacedObject(null);
    setBlockEditPanel(null); // Clear block edit panel when changing screens
  }, [selectedScreen?.id]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canvasWidth = BASE_WIDTH * zoom;
  const canvasHeight = BASE_HEIGHT * zoom;

  const getGrid = () => {
    if (!selectedScreen) return { cols: 0, rows: 0, blockSize: 0 };

    // TITLE SCREEN → 256x192 pixels
    if (selectedScreen.type === "title") {
      return {
        cols: 256,
        rows: 192,
        blockSize: zoom * 1 // 1 ZX pixel scaled by zoom
      };
    }

    // GAME SCREEN → 32x24 blocks
    return {
      cols: 32,
      rows: 24,
      blockSize: zoom * 8 // 8 ZX pixels per tile * zoom → 16px at zoom=2
    };
  };

  useEffect(() => {
    drawScreen();
  }, [selectedScreen, selectedBlock, selectedColor, isErasing, zoom, placedObjects, selectedPlacedObject]);

  // Arrow key navigation for selected object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPlacedObject || !selectedScreen || selectedScreen.type !== "game") return;

      let moved = false;
      const newPlaced = { ...selectedPlacedObject };

      if (e.key === "ArrowLeft") {
        newPlaced.x = Math.max(0, newPlaced.x - 1);
        moved = true;
      } else if (e.key === "ArrowRight") {
        newPlaced.x = Math.min(31, newPlaced.x + 1);
        moved = true;
      } else if (e.key === "ArrowUp") {
        newPlaced.y = Math.max(0, newPlaced.y - 1);
        moved = true;
      } else if (e.key === "ArrowDown") {
        newPlaced.y = Math.min(23, newPlaced.y + 1);
        moved = true;
      }

      if (moved) {
        e.preventDefault();
        const updated = placedObjects.map(obj => obj.id === newPlaced.id ? newPlaced : obj);
        setPlacedObjects(updated);
        setSelectedPlacedObject(newPlaced);
        updateScreenObjects(updated);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPlacedObject, placedObjects, selectedScreen]);

  const drawScreen = () => {
    if (!selectedScreen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, blockSize } = getGrid();

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.imageSmoothingEnabled = false;

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += blockSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += blockSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // TITLE or LOADING SCREEN
    if (selectedScreen.type === "title" || selectedScreen.type === "loading") {
      selectedScreen.pixels?.forEach((row, y) => {
        row.forEach((color, x) => {
          if (!color) return;
          ctx.fillStyle = color.value;
          ctx.fillRect(
            x * blockSize,
            y * blockSize,
            blockSize,
            blockSize
          );
        });
      });
    }

    // GAME SCREEN
    else {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {

          const blockId = selectedScreen.tiles[y]?.[x];
          if (!blockId) continue;

          const block = blocks.find(b => b.id === blockId);
          if (!block?.sprite?.frames?.[0]?.pixels) continue;

          const sprite = block.sprite;
          const pixelScale = blockSize / 8;

          sprite.frames[0].pixels.forEach((row, py) => {
            row.forEach((colorIndex, px) => {
              if (!colorIndex) return;

              const col = SPECTRUM_COLORS[colorIndex]?.value || "#000";
              ctx.fillStyle = col;
              ctx.fillRect(
                x * blockSize + px * pixelScale,
                y * blockSize + py * pixelScale,
                pixelScale,
                pixelScale
              );
            });
          });
        }
      }

      // Draw placed objects
      console.log("Drawing placed objects:", placedObjects.length, placedObjects);
      placedObjects.forEach(placed => {
        const obj = objects.find(o => o.id === placed.objectId);
        if (!obj) {
          console.log("Object not found for placed object:", placed);
          return;
        }

        const sprite = sprites.find(s => s.id === obj.spriteId);
        if (!sprite?.frames?.[0]?.pixels) {
          console.log("Sprite not found or has no pixels:", obj.spriteId);
          return;
        }

        const pixelScale = blockSize / 8;
        const startX = placed.x * blockSize;
        const startY = placed.y * blockSize;

        console.log(`Drawing object ${obj.name} at (${placed.x}, ${placed.y}) -> canvas (${startX}, ${startY})`);

        const spriteWidth = sprite.frames[0].pixels[0]?.length || 8;
        const spriteHeight = sprite.frames[0].pixels.length || 8;

        sprite.frames[0].pixels.forEach((row, py) => {
          row.forEach((colorIndex, px) => {
            if (!colorIndex) return;

            const col = SPECTRUM_COLORS[colorIndex]?.value || "#000";
            ctx.fillStyle = col;
            
            // Flip horizontally if direction is left
            const drawX = placed.direction === "left" 
              ? startX + (spriteWidth - 1 - px) * pixelScale 
              : startX + px * pixelScale;
            
            ctx.fillRect(
              drawX,
              startY + py * pixelScale,
              pixelScale,
              pixelScale
            );
          });
        });

        // Highlight selected object with animated border using actual sprite dimensions
        if (selectedPlacedObject?.id === placed.id) {
          const highlightWidth = spriteWidth * pixelScale;
          const highlightHeight = spriteHeight * pixelScale;
          
          ctx.strokeStyle = "#FFD700";
          ctx.lineWidth = 4;
          ctx.setLineDash([8, 4]);
          ctx.strokeRect(startX - 2, startY - 2, highlightWidth + 4, highlightHeight + 4);
          ctx.setLineDash([]);
          
          // Inner glow
          ctx.strokeStyle = "rgba(255, 215, 0, 0.3)";
          ctx.lineWidth = 2;
          ctx.strokeRect(startX - 4, startY - 4, highlightWidth + 8, highlightHeight + 8);
        }
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { blockSize } = getGrid();

    const x = Math.floor((e.clientX - rect.left) / blockSize);
    const y = Math.floor((e.clientY - rect.top) / blockSize);

    if (selectedScreen.type === "title" || selectedScreen.type === "loading") {
      const newPixels = selectedScreen.pixels?.map(row => [...row]) || [];
      newPixels[y][x] = isErasing
        ? SPECTRUM_COLORS[0]
        : selectedColor;

      updateScreen({ ...selectedScreen, pixels: newPixels });
    } else if (selectedScreen.type === "game") {
      // Check if clicked on existing object
      const clickedObject = placedObjects.find(obj => obj.x === x && obj.y === y);
      
      if (clickedObject) {
        setSelectedPlacedObject(clickedObject);
        setIsDragging(true);
        setDragOffset({ x: 0, y: 0 });
        return;
      }

      // Deselect if clicking empty space
      setSelectedPlacedObject(null);

      // Paint blocks
      if (selectedBlock || isErasing) {
        const newTiles = selectedScreen.tiles.map(row => [...row]);
        newTiles[y][x] = isErasing ? "" : selectedBlock?.id || "";
        updateScreen({ ...selectedScreen, tiles: newTiles });
      }
    }
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!selectedScreen || selectedScreen.type !== "game" || !draggedObjectId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { blockSize } = getGrid();

    const x = Math.floor((e.clientX - rect.left) / blockSize);
    const y = Math.floor((e.clientY - rect.top) / blockSize);

    const object = objects.find(o => o.id === draggedObjectId);
    if (!object) return;

    // Check if it's a player type and if one already exists
    if (object.type === "player") {
      const existingPlayer = placedObjects.find(p => {
        const obj = objects.find(o => o.id === p.objectId);
        return obj?.type === "player";
      });
      
      if (existingPlayer) {
        toast.error("Only one player can be placed on the screen");
        setDraggedObjectId(null);
        return;
      }
    }

    const newPlaced: PlacedObject = {
      id: `placed-${Date.now()}`,
      objectId: object.id,
      x: Math.max(0, Math.min(31, x)),
      y: Math.max(0, Math.min(23, y)),
      direction: "right"
    };

    console.log("Dropping object:", newPlaced, "Total objects before:", placedObjects.length);

    const updated = [...placedObjects, newPlaced];
    setPlacedObjects(updated);
    setSelectedPlacedObject(newPlaced);
    updateScreenObjects(updated);
    setDraggedObjectId(null);
    
    console.log("Objects after drop:", updated.length, updated);
    
    toast.success(`Placed ${object.name} at (${newPlaced.x}, ${newPlaced.y})`);
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  const updateScreen = (updatedScreen: Screen) => {
    onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));
    setSelectedScreen(updatedScreen);
  };

  const updateScreenObjects = (updated: PlacedObject[]) => {
    if (!selectedScreen) return;
    const updatedScreen = { ...selectedScreen, placedObjects: updated };
    updateScreen(updatedScreen);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedScreen || selectedScreen.type !== "game") {
      if (isDrawing) handleCanvasClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { blockSize } = getGrid();

    const x = Math.floor((e.clientX - rect.left) / blockSize);
    const y = Math.floor((e.clientY - rect.top) / blockSize);

    if (isDragging && selectedPlacedObject) {
      const updated = placedObjects.map(obj => 
        obj.id === selectedPlacedObject.id 
          ? { ...obj, x: Math.max(0, Math.min(31, x)), y: Math.max(0, Math.min(23, y)) }
          : obj
      );
      setPlacedObjects(updated);
      const newPos = updated.find(o => o.id === selectedPlacedObject.id);
      if (newPos) setSelectedPlacedObject(newPos);
      updateScreenObjects(updated);
    } else if (isDrawing) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsDragging(false);
  };

  const handleCreateScreen = () => {
    if (!newScreenName || !newScreenType) return;

    const newScreen: Screen = {
      id: `screen-${Date.now()}`,
      name: newScreenName,
      type: newScreenType as Screen["type"],
      width: 512,
      height: 384,
      tiles: newScreenType === "game"
        ? Array(24).fill(null).map(() => Array(32).fill(""))
        : undefined,
      pixels: (newScreenType === "title" || newScreenType === "loading")
        ? Array(192).fill(null).map(() =>
            Array(256).fill(SPECTRUM_COLORS[0]) // Black
          )
        : undefined,
      placedObjects: []
    };

    onScreensChange([...screens, newScreen]);
    setSelectedScreen(newScreen);
    setNewScreenName("");
    setNewScreenType("");

    toast.success("New screen created!");
  };

  const handleFlipObject = () => {
    if (!selectedPlacedObject) return;
    const updated = placedObjects.map(obj =>
      obj.id === selectedPlacedObject.id
        ? { ...obj, direction: obj.direction === "left" ? "right" : "left" as "left" | "right" }
        : obj
    );
    setPlacedObjects(updated);
    const flipped = updated.find(o => o.id === selectedPlacedObject.id);
    if (flipped) setSelectedPlacedObject(flipped);
    updateScreenObjects(updated);
  };

  const handleDeleteObject = () => {
    if (!selectedPlacedObject) return;
    const updated = placedObjects.filter(obj => obj.id !== selectedPlacedObject.id);
    setPlacedObjects(updated);
    setSelectedPlacedObject(null);
    updateScreenObjects(updated);
    toast.success("Object deleted");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

      {/* MAIN */}
      <div className="lg:col-span-3 space-y-4">

        {/* Show Loading Screen Creator for loading type */}
        {selectedScreen?.type === "loading" ? (
          <LoadingScreenCreator 
            screen={selectedScreen} 
            onScreenChange={(updatedScreen) => {
              onScreensChange(screens.map(s => s.id === updatedScreen.id ? updatedScreen : s));
              setSelectedScreen(updatedScreen);
            }}
            onBlockEditPanelChange={(panel) => setBlockEditPanel(panel)}
          />
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">Screen Designer</h2>

                <div className="flex items-center gap-2">

                  <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 1))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 1))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>

                  <Button size="sm" variant={isErasing ? "default" : "outline"} onClick={() => setIsErasing(!isErasing)}>
                    <Eraser className="w-4 h-4 mr-2" />Erase
                  </Button>
                </div>
              </div>

          <div className="flex justify-center p-4 bg-muted rounded border">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
              style={{
                imageRendering: "pixelated",
                width: canvasWidth,
                height: canvasHeight
              }}
            />
          </div>
        </Card>

        {/* TITLE PALETTE */}
        {selectedScreen?.type === "title" && (
          <Card className="p-4">
            <ColorPalette selectedColor={selectedColor} onColorSelect={setSelectedColor} />
          </Card>
        )}

        {/* GAME SCREEN ASSETS */}
        {selectedScreen?.type === "game" && (
          <>
            {/* OBJECTS */}
            <Card className="p-4">
              <h3 className="text-sm font-bold mb-2">Objects (Drag to Place)</h3>
              <div className="grid grid-cols-8 md:grid-cols-12 gap-3">
                {objects.map(obj => {
                  const sprite = blocks.find(b => b.id === obj.spriteId)?.sprite;
                  
                  return (
                    <div
                      key={obj.id}
                      draggable
                      onDragStart={() => setDraggedObjectId(obj.id)}
                      onDragEnd={() => setDraggedObjectId(null)}
                      className={`aspect-square border rounded p-0.5 hover:border-primary cursor-grab active:cursor-grabbing
                        ${draggedObjectId === obj.id ? "opacity-50" : ""}
                        border-border`}
                      title={obj.name}
                    >
                      {sprite?.preview ? (
                        <img
                          src={sprite.preview}
                          alt={obj.name}
                          className="pixelated w-full h-full pointer-events-none"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-xs pointer-events-none">
                          {obj.type[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* BLOCKS */}
            <Card className="p-4">
              <h3 className="text-sm font-bold mb-2">Blocks</h3>
              <div className="grid grid-cols-8 md:grid-cols-12 xl:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                {blocks.map(block => {
                  if (!block.sprite?.preview && block.sprite?.frames?.[0]?.pixels) {
                    const canvas = document.createElement("canvas");
                    const size = 32;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d");

                    if (ctx && block.sprite.frames[0]?.pixels) {
                      const pixelSize = size / block.sprite.frames[0].pixels.length;
                      block.sprite.frames[0].pixels.forEach((row, y) => {
                        row.forEach((colorIndex, x) => {
                          if (colorIndex) {
                            ctx.fillStyle = SPECTRUM_COLORS[colorIndex]?.value || "#000";
                            ctx.fillRect(
                              x * pixelSize,
                              y * pixelSize,
                              pixelSize,
                              pixelSize
                            );
                          }
                        });
                      });

                      block.sprite.preview = canvas.toDataURL();
                    }
                  }

                  return (
                    <button
                      key={block.id}
                      className={`aspect-square border rounded p-0.5 hover:border-primary
                        ${selectedBlock?.id === block.id && !isErasing
                          ? "border-primary retro-glow"
                          : "border-border"}`}
                      onClick={() => {
                        setSelectedBlock(block);
                        setIsErasing(false);
                      }}
                    >
                      {block.sprite?.preview ? (
                        <img
                          src={block.sprite.preview}
                          alt={block.name}
                          className="pixelated w-full h-full"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </>
        )}
          </>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="space-y-4">

        {/* Block Edit Panel (when editing loading screen blocks) */}
        {blockEditPanel ? (
          <>{blockEditPanel}</>
        ) : (
          <>
            {/* EDIT PANEL - Selected Object */}
            {selectedPlacedObject && selectedScreen?.type === "game" && (() => {
              const globalObject = objects.find(o => o.id === selectedPlacedObject.objectId);
              if (!globalObject) return null;

              const hasOverrides = selectedPlacedObject.propertyOverrides && Object.keys(selectedPlacedObject.propertyOverrides).length > 0;

              const updatePropertyOverride = (key: string, value: any) => {
                const updated = placedObjects.map(obj =>
                  obj.id === selectedPlacedObject.id
                    ? { 
                        ...obj, 
                        propertyOverrides: { 
                          ...(obj.propertyOverrides || {}), 
                          [key]: value 
                        } 
                      }
                    : obj
                );
                setPlacedObjects(updated);
                const updatedObj = updated.find(o => o.id === selectedPlacedObject.id);
                if (updatedObj) setSelectedPlacedObject(updatedObj);
                updateScreenObjects(updated);
              };

              const resetPropertyOverride = (key: string) => {
                if (!selectedPlacedObject.propertyOverrides) return;
                const updated = placedObjects.map(obj => {
                  if (obj.id === selectedPlacedObject.id) {
                    const newOverrides = { ...obj.propertyOverrides };
                    delete newOverrides[key];
                    return {
                      ...obj,
                      propertyOverrides: Object.keys(newOverrides).length > 0 ? newOverrides : undefined
                    };
                  }
                  return obj;
                });
                setPlacedObjects(updated);
                const updatedObj = updated.find(o => o.id === selectedPlacedObject.id);
                if (updatedObj) setSelectedPlacedObject(updatedObj);
                updateScreenObjects(updated);
              };

              const getEffectiveValue = (key: string) => {
                return selectedPlacedObject.propertyOverrides?.[key] ?? globalObject.properties[key];
              };

              const isOverridden = (key: string) => {
                return selectedPlacedObject.propertyOverrides?.hasOwnProperty(key);
              };

              return (
                <Card className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary">Edit Object</h3>
                    {hasOverrides && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 pb-2 border-b">
                    <Label className="text-xs text-muted-foreground">Object Type</Label>
                    <div className="text-sm font-medium capitalize">{globalObject.name}</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Position</Label>
                    <div className="text-sm text-muted-foreground">
                      X: {selectedPlacedObject.x}, Y: {selectedPlacedObject.y}
                    </div>
                    <div className="text-xs text-muted-foreground">Use arrow keys to nudge</div>
                  </div>

                  {/* Player Properties */}
                  {globalObject.type === "player" && (
                    <div className="space-y-3 border-t pt-3">
                      <Label className="text-sm font-semibold">Properties</Label>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Speed: {getEffectiveValue("speed")}</Label>
                          {isOverridden("speed") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("speed")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={getEffectiveValue("speed") || 3}
                          onChange={(e) => updatePropertyOverride("speed", parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Jump Height: {getEffectiveValue("jumpHeight")}px</Label>
                          {isOverridden("jumpHeight") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("jumpHeight")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="16"
                          max="80"
                          step="4"
                          value={getEffectiveValue("jumpHeight") || 40}
                          onChange={(e) => updatePropertyOverride("jumpHeight", parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Gravity: {getEffectiveValue("gravity")}</Label>
                          {isOverridden("gravity") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("gravity")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={getEffectiveValue("gravity") || 5}
                          onChange={(e) => updatePropertyOverride("gravity", parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Enemy Properties */}
                  {globalObject.type === "enemy" && (
                    <div className="space-y-3 border-t pt-3">
                      <Label className="text-sm font-semibold">Properties</Label>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Speed: {getEffectiveValue("speed")}</Label>
                          {isOverridden("speed") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("speed")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          value={getEffectiveValue("speed") || 2}
                          onChange={(e) => updatePropertyOverride("speed", parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Patrol Type</Label>
                          {isOverridden("patrolType") && (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("patrolType")}>
                              Reset
                            </Button>
                          )}
                        </div>
                        <Select
                          value={getEffectiveValue("patrolType") || "left-right"}
                          onValueChange={(value) => updatePropertyOverride("patrolType", value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left-right">Left-Right</SelectItem>
                            <SelectItem value="up-down">Up-Down</SelectItem>
                            <SelectItem value="circular">Circular</SelectItem>
                            <SelectItem value="stationary">Stationary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Damage: {getEffectiveValue("damage")}</Label>
                          {isOverridden("damage") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("damage")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={getEffectiveValue("damage") || 10}
                          onChange={(e) => updatePropertyOverride("damage", parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">AI Behavior</Label>
                          {isOverridden("aiBehavior") && (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("aiBehavior")}>
                              Reset
                            </Button>
                          )}
                        </div>
                        <Select
                          value={getEffectiveValue("aiBehavior") || "patrol"}
                          onValueChange={(value) => updatePropertyOverride("aiBehavior", value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="patrol">Patrol</SelectItem>
                            <SelectItem value="chase">Chase Player</SelectItem>
                            <SelectItem value="guard">Guard Area</SelectItem>
                            <SelectItem value="random">Random Movement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Collectable Properties */}
                  {globalObject.type === "collectable" && (
                    <div className="space-y-3 border-t pt-3">
                      <Label className="text-sm font-semibold">Properties</Label>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Points: {getEffectiveValue("points")}</Label>
                          {isOverridden("points") ? (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("points")}>
                              Reset
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Default</span>
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={getEffectiveValue("points") || 10}
                          onChange={(e) => updatePropertyOverride("points", parseInt(e.target.value))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Required to Exit</Label>
                          {isOverridden("requiredToExit") && (
                            <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => resetPropertyOverride("requiredToExit")}>
                              Reset
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={getEffectiveValue("requiredToExit") || false}
                            onChange={(e) => updatePropertyOverride("requiredToExit", e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-muted-foreground">Must collect to exit level</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 border-t pt-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleFlipObject}
                    >
                      <FlipHorizontal className="w-4 h-4 mr-1" />
                      Flip
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="flex-1"
                      onClick={handleDeleteObject}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </Card>
              );
            })()}

            <Card className="p-4 space-y-2">
              <Label>Screen Name</Label>
              <Input value={newScreenName} onChange={e => setNewScreenName(e.target.value)} placeholder="Enter name" />

              <Label>Screen Type</Label>
              <Select value={newScreenType} onValueChange={(value) => setNewScreenType(value as "title" | "game" | "loading" | "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loading">Loading Screen</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="game">Game</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className="w-full mt-2"
                disabled={!newScreenName || !newScreenType}
                onClick={handleCreateScreen}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Screen
              </Button>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-bold text-primary mb-2">Screens</h3>
              <div className="space-y-2 overflow-auto">
                {screens.map(screen => (
                  <div
                    key={screen.id}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all
                      ${selectedScreen?.id === screen.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                    onClick={() => setSelectedScreen(screen)}
                  >
                    <span className="truncate">{screen.name}</span>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScreensChange(screens.filter(s => s.id !== screen.id));
                        if (selectedScreen?.id === screen.id) {
                          setSelectedScreen(screens.find(s => s.id !== screen.id) || null);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
