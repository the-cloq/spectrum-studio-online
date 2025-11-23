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
        return { speed: 5, jumpHeight: 10, maxEnergy: 100 };
      case "enemy":
        return { damage: 10, movementPattern: "patrol" as const, patrolDistance: 50, patrolSpeed: 3 };
      case "collectible":
        return { points: 10, energyBonus: 0, itemType: "coin" as const };
      case "static":
        return { blocking: true, deadly: false, interactable: false };
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
            <Button onClick={() => createObject("collectible")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Item
            </Button>
            <Button onClick={() => createObject("static")} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Static
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
                      <SelectItem value="collectible">Collectible</SelectItem>
                      <SelectItem value="static">Static</SelectItem>
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
                      <Label>Patrol Distance: {selectedObject.properties.patrolDistance}</Label>
                      <Slider
                        value={[selectedObject.properties.patrolDistance || 50]}
                        onValueChange={([value]) => updateProperty("patrolDistance", value)}
                        min={10}
                        max={200}
                        step={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Patrol Speed: {selectedObject.properties.patrolSpeed}</Label>
                      <Slider
                        value={[selectedObject.properties.patrolSpeed || 3]}
                        onValueChange={([value]) => updateProperty("patrolSpeed", value)}
                        min={1}
                        max={10}
                        step={1}
                      />
                    </div>
                  </>
                )}

                {selectedObject.type === "collectible" && (
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
                  </>
                )}

                {selectedObject.type === "static" && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Blocking</Label>
                      <Switch
                        checked={selectedObject.properties.blocking || false}
                        onCheckedChange={(checked) => updateProperty("blocking", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Deadly</Label>
                      <Switch
                        checked={selectedObject.properties.deadly || false}
                        onCheckedChange={(checked) => updateProperty("deadly", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Interactable</Label>
                      <Switch
                        checked={selectedObject.properties.interactable || false}
                        onCheckedChange={(checked) => updateProperty("interactable", checked)}
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
