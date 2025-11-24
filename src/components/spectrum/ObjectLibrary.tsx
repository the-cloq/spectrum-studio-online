import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Copy, Play, Pause } from "lucide-react";
import { type GameObject, type ObjectType, type Sprite, type AnimationSet } from "@/types/spectrum";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ObjectLibraryProps {
  objects: GameObject[];
  sprites: Sprite[];
  onObjectsChange: (objects: GameObject[]) => void;
}

export function ObjectLibrary({ objects, sprites, onObjectsChange }: ObjectLibraryProps) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    objects[0]?.id || null
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playerPosition, setPlayerPosition] = useState({ x: 64, y: 64 });
  const [playerAction, setPlayerAction] = useState<keyof AnimationSet>("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  const createObject = (type: ObjectType) => {
    if (sprites.length === 0) {
      toast.error("Create a sprite first!");
      return;
    }

    const newObject: GameObject = {
      id: `object-${Date.now()}`,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type,
      spriteId: sprites[0].id,
      properties: getDefaultProperties(type),
    };

    onObjectsChange([...objects, newObject]);
    setSelectedObjectId(newObject.id);
    toast.success(`${type} object created!`);
  };

  const getDefaultProperties = (type: ObjectType) => {
    switch (type) {
      case "player":
        return { speed: 5, jumpHeight: 10, maxEnergy: 100, maxFallDistance: 20 };
      case "enemy":
        return { damage: 10, movementPattern: "patrol" as const, respawnDelay: 3000, direction: "right" as const };
      case "ammunition":
        return { projectileSpeed: 8, projectileDamage: 5, projectileRange: 100 };
      case "collectable":
        return { points: 10, energyBonus: 0, itemType: "coin" as const, oneTime: true };
      case "door":
        return { targetRoom: "", targetFloor: 0 };
      case "exit":
        return { targetLevel: "", activationConditions: "" };
      case "moving-platform":
        return { platformType: "horizontal" as const, platformSpeed: 2, platformRange: 8, pauseAtEnds: 500, startDirection: "right" as const, repeatType: "ping-pong" as const, playerCarry: true };
    }
  };

  const deleteObject = (id: string) => {
    onObjectsChange(objects.filter(obj => obj.id !== id));
    if (selectedObjectId === id) {
      setSelectedObjectId(objects[0]?.id || null);
    }
    toast.success("Object deleted");
  };

  const duplicateObject = (obj: GameObject) => {
    const newObject: GameObject = {
      ...obj,
      id: `object-${Date.now()}`,
      name: `${obj.name} (copy)`,
    };
    onObjectsChange([...objects, newObject]);
    setSelectedObjectId(newObject.id);
    toast.success("Object duplicated!");
  };

  const updateObject = (updates: Partial<GameObject>) => {
    if (!selectedObject) return;
    
    onObjectsChange(
      objects.map(obj =>
        obj.id === selectedObjectId ? { ...obj, ...updates } : obj
      )
    );
  };

  const updateProperty = (key: string, value: any) => {
    if (!selectedObject) return;
    
    updateObject({
      properties: { ...selectedObject.properties, [key]: value },
    });
  };

  const updateAnimation = (action: keyof AnimationSet, spriteId: string) => {
    if (!selectedObject) return;
    
    updateObject({
      animations: {
        ...selectedObject.animations,
        [action]: spriteId || undefined,
      },
    });
  };

  const renderSpritePreview = (spriteId: string, scale = 1) => {
    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite || !sprite.frames?.[0]) return null;

    const size = parseInt(sprite.size.split("x")[0]);
    const pixelSize = 8 * scale;
    
    return (
      <div className="border-2 border-border rounded p-2 inline-block bg-black">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${size}, ${pixelSize}px)`,
            gap: "1px",
          }}
        >
          {sprite.frames[0].pixels.map((row, y) =>
            row.map((pixel, x) => (
              <div
                key={`${x}-${y}`}
                style={{
                  width: `${pixelSize}px`,
                  height: `${pixelSize}px`,
                }}
                className={cn(
                  pixel === 1 ? "bg-white" : "bg-black"
                )}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  // Animation frame cycling
  useEffect(() => {
    if (!isPlaying || !selectedObject) return;

    const sprite = sprites.find(s => s.id === selectedObject.spriteId);
    if (!sprite || !sprite.frames || sprite.frames.length === 0) return;

    const fps = sprite.animationSpeed || 6;
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % sprite.frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, selectedObject, sprites]);

  // Keyboard controls for player testing
  useEffect(() => {
    if (!selectedObject || selectedObject.type !== "player") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const speed = selectedObject.properties.speed || 5;

      switch (key) {
        case "q":
          setPlayerPosition(prev => ({ ...prev, x: Math.max(0, prev.x - speed) }));
          setPlayerAction("moveLeft");
          break;
        case "w":
          setPlayerPosition(prev => ({ ...prev, x: Math.min(200, prev.x + speed) }));
          setPlayerAction("moveRight");
          break;
        case "p":
          setPlayerPosition(prev => ({ ...prev, y: Math.max(0, prev.y - (selectedObject.properties.jumpHeight || 10)) }));
          setPlayerAction("jump");
          setTimeout(() => {
            setPlayerPosition(prev => ({ ...prev, y: 64 }));
            setPlayerAction("idle");
          }, 300);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "q" || key === "w") {
        setPlayerAction("idle");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedObject]);

  // Draw sprite on canvas
  useEffect(() => {
    if (!selectedObject || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Get the appropriate sprite based on action
    let spriteId = selectedObject.spriteId;
    if (selectedObject.type === "player" && selectedObject.animations) {
      spriteId = selectedObject.animations[playerAction] || selectedObject.spriteId;
    }

    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite || !sprite.frames || sprite.frames.length === 0) {
      ctx.fillStyle = "#666666";
      ctx.font = "12px monospace";
      ctx.fillText("No animation", 50, 75);
      return;
    }

    const frame = sprite.frames[currentFrame % sprite.frames.length];
    const pixelSize = 4;
    const startX = selectedObject.type === "player" ? playerPosition.x : 64;
    const startY = selectedObject.type === "player" ? playerPosition.y : 64;

    frame.pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel === 1) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(
            startX + x * pixelSize,
            startY + y * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      });
    });

    // Draw grid
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, [selectedObject, sprites, currentFrame, playerPosition, playerAction]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Object Library Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Object Library</CardTitle>
          <div className="pt-2">
            <Select onValueChange={(value: ObjectType) => createObject(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Create Object..." />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="enemy">Enemy</SelectItem>
                <SelectItem value="ammunition">Ammunition</SelectItem>
                <SelectItem value="collectable">Collectable</SelectItem>
                <SelectItem value="door">Door</SelectItem>
                <SelectItem value="exit">Exit</SelectItem>
                <SelectItem value="moving-platform">Moving Platform</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {objects.map((obj) => {
              const sprite = sprites.find(s => s.id === obj.spriteId);
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={cn(
                    "p-3 border-2 rounded cursor-pointer transition-colors flex items-center justify-between",
                    selectedObjectId === obj.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {sprite && renderSpritePreview(sprite.id)}
                    <div>
                      <div className="font-semibold">{obj.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {obj.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateObject(obj);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteObject(obj.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {objects.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No objects yet. Create one!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Object Editor Panel */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{selectedObject ? "Edit Object" : "Select an Object"}</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedObject ? (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="animations">Animations</TabsTrigger>
                <TabsTrigger value="properties">Properties</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label>Object Name</Label>
                  <Input
                    value={selectedObject.name}
                    onChange={(e) => updateObject({ name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Object Type</Label>
                  <Select
                    value={selectedObject.type}
                    onValueChange={(value: ObjectType) => {
                      updateObject({ 
                        type: value,
                        properties: getDefaultProperties(value),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="enemy">Enemy</SelectItem>
                      <SelectItem value="ammunition">Ammunition</SelectItem>
                      <SelectItem value="collectable">Collectable</SelectItem>
                      <SelectItem value="door">Door</SelectItem>
                      <SelectItem value="exit">Exit</SelectItem>
                      <SelectItem value="moving-platform">Moving Platform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sprite</Label>
                  <Select
                    value={selectedObject.spriteId}
                    onValueChange={(value) => updateObject({ spriteId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {sprites.map((sprite) => (
                        <SelectItem key={sprite.id} value={sprite.id}>
                          {sprite.name} ({sprite.size})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="animations" className="space-y-4 max-h-[600px] overflow-y-auto">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Move Left</Label>
                    <Select
                      value={selectedObject.animations?.moveLeft || ""}
                      onValueChange={(value) => updateAnimation("moveLeft", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.moveLeft && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.moveLeft, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Move Right</Label>
                    <Select
                      value={selectedObject.animations?.moveRight || ""}
                      onValueChange={(value) => updateAnimation("moveRight", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (will mirror left)" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None (will mirror left)</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.moveRight && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.moveRight, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Move Up</Label>
                    <Select
                      value={selectedObject.animations?.moveUp || ""}
                      onValueChange={(value) => updateAnimation("moveUp", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.moveUp && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.moveUp, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Move Down</Label>
                    <Select
                      value={selectedObject.animations?.moveDown || ""}
                      onValueChange={(value) => updateAnimation("moveDown", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (will mirror up)" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None (will mirror up)</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.moveDown && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.moveDown, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Idle</Label>
                    <Select
                      value={selectedObject.animations?.idle || ""}
                      onValueChange={(value) => updateAnimation("idle", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.idle && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.idle, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Jump</Label>
                    <Select
                      value={selectedObject.animations?.jump || ""}
                      onValueChange={(value) => updateAnimation("jump", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.jump && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.jump, 2)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Fire</Label>
                    <Select
                      value={selectedObject.animations?.fire || ""}
                      onValueChange={(value) => updateAnimation("fire", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="">None</SelectItem>
                        {sprites.map((sprite) => (
                          <SelectItem key={sprite.id} value={sprite.id}>
                            {sprite.name} ({sprite.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedObject.animations?.fire && (
                      <div className="pt-2">
                        {renderSpritePreview(selectedObject.animations.fire, 2)}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="properties" className="space-y-4">
                {selectedObject.type === "player" && (
                  <>
                    <div className="space-y-2">
                      <Label>Speed: {selectedObject.properties.speed}</Label>
                      <Slider
                        value={[selectedObject.properties.speed || 5]}
                        onValueChange={([value]) => updateProperty("speed", value)}
                        min={1}
                        max={20}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jump Height: {selectedObject.properties.jumpHeight}</Label>
                      <Slider
                        value={[selectedObject.properties.jumpHeight || 10]}
                        onValueChange={([value]) => updateProperty("jumpHeight", value)}
                        min={1}
                        max={30}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Energy: {selectedObject.properties.maxEnergy}</Label>
                      <Slider
                        value={[selectedObject.properties.maxEnergy || 100]}
                        onValueChange={([value]) => updateProperty("maxEnergy", value)}
                        min={10}
                        max={200}
                        step={10}
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "enemy" && (
                  <>
                    <div className="space-y-2">
                      <Label>Damage: {selectedObject.properties.damage}</Label>
                      <Slider
                        value={[selectedObject.properties.damage || 10]}
                        onValueChange={([value]) => updateProperty("damage", value)}
                        min={1}
                        max={50}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Movement Pattern</Label>
                      <Select
                        value={selectedObject.properties.movementPattern || "patrol"}
                        onValueChange={(value) => updateProperty("movementPattern", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stationary">Stationary</SelectItem>
                          <SelectItem value="patrol">Patrol</SelectItem>
                          <SelectItem value="chase">Chase Player</SelectItem>
                          <SelectItem value="fly">Flying</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Respawn Delay (ms): {selectedObject.properties.respawnDelay}</Label>
                      <Slider
                        value={[selectedObject.properties.respawnDelay || 3000]}
                        onValueChange={([value]) => updateProperty("respawnDelay", value)}
                        min={0}
                        max={10000}
                        step={500}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <Select
                        value={selectedObject.properties.direction || "right"}
                        onValueChange={(value) => updateProperty("direction", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="up">Up</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {selectedObject.type === "ammunition" && (
                  <>
                    <div className="space-y-2">
                      <Label>Projectile Speed: {selectedObject.properties.projectileSpeed}</Label>
                      <Slider
                        value={[selectedObject.properties.projectileSpeed || 8]}
                        onValueChange={([value]) => updateProperty("projectileSpeed", value)}
                        min={1}
                        max={20}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Projectile Damage: {selectedObject.properties.projectileDamage}</Label>
                      <Slider
                        value={[selectedObject.properties.projectileDamage || 5]}
                        onValueChange={([value]) => updateProperty("projectileDamage", value)}
                        min={1}
                        max={50}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Projectile Range: {selectedObject.properties.projectileRange}</Label>
                      <Slider
                        value={[selectedObject.properties.projectileRange || 100]}
                        onValueChange={([value]) => updateProperty("projectileRange", value)}
                        min={10}
                        max={500}
                        step={10}
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "collectable" && (
                  <>
                    <div className="space-y-2">
                      <Label>Item Type</Label>
                      <Select
                        value={selectedObject.properties.itemType || "coin"}
                        onValueChange={(value) => updateProperty("itemType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coin">Coin</SelectItem>
                          <SelectItem value="key">Key</SelectItem>
                          <SelectItem value="powerup">Power-up</SelectItem>
                          <SelectItem value="life">Extra Life</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Points: {selectedObject.properties.points}</Label>
                      <Slider
                        value={[selectedObject.properties.points || 10]}
                        onValueChange={([value]) => updateProperty("points", value)}
                        min={0}
                        max={1000}
                        step={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Energy Bonus: {selectedObject.properties.energyBonus}</Label>
                      <Slider
                        value={[selectedObject.properties.energyBonus || 0]}
                        onValueChange={([value]) => updateProperty("energyBonus", value)}
                        min={0}
                        max={50}
                        step={5}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>One Time Only</Label>
                      <Switch
                        checked={selectedObject.properties.oneTime || true}
                        onCheckedChange={(checked) => updateProperty("oneTime", checked)}
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "door" && (
                  <>
                    <div className="space-y-2">
                      <Label>Target Room</Label>
                      <Input
                        value={selectedObject.properties.targetRoom || ""}
                        onChange={(e) => updateProperty("targetRoom", e.target.value)}
                        placeholder="e.g., room-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Floor: {selectedObject.properties.targetFloor}</Label>
                      <Slider
                        value={[selectedObject.properties.targetFloor || 0]}
                        onValueChange={([value]) => updateProperty("targetFloor", value)}
                        min={0}
                        max={10}
                        step={1}
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "exit" && (
                  <>
                    <div className="space-y-2">
                      <Label>Target Level</Label>
                      <Input
                        value={selectedObject.properties.targetLevel || ""}
                        onChange={(e) => updateProperty("targetLevel", e.target.value)}
                        placeholder="e.g., level-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Activation Conditions</Label>
                      <Input
                        value={selectedObject.properties.activationConditions || ""}
                        onChange={(e) => updateProperty("activationConditions", e.target.value)}
                        placeholder="e.g., all-keys-collected"
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "moving-platform" && (
                  <>
                    <div className="space-y-2">
                      <Label>Platform Type</Label>
                      <Select
                        value={selectedObject.properties.platformType || "horizontal"}
                        onValueChange={(value) => updateProperty("platformType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="horizontal">Horizontal Mover</SelectItem>
                          <SelectItem value="vertical">Vertical Mover</SelectItem>
                          <SelectItem value="elevator">Elevator</SelectItem>
                          <SelectItem value="rope">Rope</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Speed (pixels/frame): {selectedObject.properties.platformSpeed}</Label>
                      <Slider
                        value={[selectedObject.properties.platformSpeed || 2]}
                        onValueChange={([value]) => updateProperty("platformSpeed", value)}
                        min={1}
                        max={8}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Range (blocks): {selectedObject.properties.platformRange}</Label>
                      <Slider
                        value={[selectedObject.properties.platformRange || 8]}
                        onValueChange={([value]) => updateProperty("platformRange", value)}
                        min={1}
                        max={16}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pause at Ends (ms): {selectedObject.properties.pauseAtEnds}</Label>
                      <Slider
                        value={[selectedObject.properties.pauseAtEnds || 500]}
                        onValueChange={([value]) => updateProperty("pauseAtEnds", value)}
                        min={0}
                        max={2000}
                        step={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Direction</Label>
                      <Select
                        value={selectedObject.properties.startDirection || "right"}
                        onValueChange={(value) => updateProperty("startDirection", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="up">Up</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Repeat Type</Label>
                      <Select
                        value={selectedObject.properties.repeatType || "ping-pong"}
                        onValueChange={(value) => updateProperty("repeatType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ping-pong">Ping-Pong</SelectItem>
                          <SelectItem value="loop">Loop</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Player Carry</Label>
                      <Switch
                        checked={selectedObject.properties.playerCarry !== false}
                        onCheckedChange={(checked) => updateProperty("playerCarry", checked)}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Select an object from the library to edit its properties
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedObject ? (
            <div className="space-y-4">
              <div className="border-2 border-border rounded bg-black p-2">
                <canvas
                  ref={canvasRef}
                  width={256}
                  height={192}
                  className="w-full"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>

              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <><Pause className="w-4 h-4 mr-1" /> Pause</>
                  ) : (
                    <><Play className="w-4 h-4 mr-1" /> Play</>
                  )}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Frame: {currentFrame + 1} / {sprites.find(s => s.id === selectedObject.spriteId)?.frames?.length || 1}
                </div>
              </div>

              {selectedObject.type === "player" && (
                <div className="space-y-2 p-3 border border-border rounded bg-muted/30">
                  <div className="text-xs font-medium mb-2">Interactive Controls</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-background border border-border rounded">Q</kbd>
                      <span className="text-muted-foreground">Move Left</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-background border border-border rounded">W</kbd>
                      <span className="text-muted-foreground">Move Right</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-background border border-border rounded">P</kbd>
                      <span className="text-muted-foreground">Jump</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">
                    Current: {playerAction}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <div>Type: <span className="capitalize">{selectedObject.type}</span></div>
                <div>Sprite: {sprites.find(s => s.id === selectedObject.spriteId)?.name || "Unknown"}</div>
                {sprites.find(s => s.id === selectedObject.spriteId) && (
                  <div>FPS: {sprites.find(s => s.id === selectedObject.spriteId)?.animationSpeed || 6}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p className="mb-2">No animation created yet</p>
              <p className="text-xs">Select an object to preview</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
