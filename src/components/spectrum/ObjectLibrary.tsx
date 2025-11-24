import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Copy } from "lucide-react";
import { type GameObject, type ObjectType, type Sprite } from "@/types/spectrum";
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

  const renderSpritePreview = (spriteId: string) => {
    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite || !sprite.frames?.[0]) return null;

    const size = parseInt(sprite.size.split("x")[0]);
    return (
      <div className="border-2 border-border rounded p-2 inline-block bg-black">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${size}, 8px)`,
            gap: "1px",
          }}
        >
          {sprite.frames[0].pixels.map((row, y) =>
            row.map((pixel, x) => (
              <div
                key={`${x}-${y}`}
                className={cn(
                  "w-2 h-2",
                  pixel === 1 ? "bg-white" : "bg-black"
                )}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Object Library Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Object Library</CardTitle>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button onClick={() => createObject("player")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Player
            </Button>
            <Button onClick={() => createObject("enemy")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Enemy
            </Button>
            <Button onClick={() => createObject("ammunition")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Ammo
            </Button>
            <Button onClick={() => createObject("collectable")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Item
            </Button>
            <Button onClick={() => createObject("door")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Door
            </Button>
            <Button onClick={() => createObject("exit")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Exit
            </Button>
            <Button onClick={() => createObject("moving-platform")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Platform
            </Button>
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic</TabsTrigger>
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
                    <SelectContent>
                      {sprites.map((sprite) => (
                        <SelectItem key={sprite.id} value={sprite.id}>
                          {sprite.name} ({sprite.size})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="pt-2">
                    {renderSpritePreview(selectedObject.spriteId)}
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
    </div>
  );
}
