import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { type Block, type Sprite, type BlockType } from "@/types/spectrum";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface BlockDesignerProps {
  sprites: Sprite[];
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
}

const BLOCK_TYPES: { value: BlockType; label: string; description: string }[] = [
  { value: "solid", label: "Solid", description: "Blocks movement" },
  { value: "deadly", label: "Deadly", description: "Kills player on contact" },
  { value: "crumbling", label: "Crumbling", description: "Breaks after standing" },
  { value: "sinking", label: "Sinking", description: "Sinks when stepped on" },
  { value: "conveyor", label: "Conveyor", description: "Moves player" },
  { value: "ice", label: "Ice / Slippery", description: "Low friction surface" },
  { value: "ladder", label: "Ladder", description: "Allows climbing" },
];

export const BlockDesigner = ({ sprites, blocks, onBlocksChange }: BlockDesignerProps) => {
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [editingBlock, setEditingBlock] = useState<Partial<Block>>({
    name: "",
    type: "solid",
    properties: {},
  });

  const safeBlocks = blocks ?? [];

  const handleCreateBlock = () => {
    if (!editingBlock.name || !editingBlock.sprite) {
      toast.error("Please select a sprite and enter a name");
      return;
    }

    const newBlock: Block = {
      id: `block-${Date.now()}`,
      name: editingBlock.name,
      sprite: editingBlock.sprite,
      type: editingBlock.type || "solid",
      properties: editingBlock.properties || {},
    };

    onBlocksChange([...safeBlocks, newBlock]);
    toast.success(`Block "${newBlock.name}" created!`);
    
    // Reset form
    setEditingBlock({
      name: "",
      type: "solid",
      properties: {},
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    onBlocksChange(safeBlocks.filter(b => b.id !== blockId));
    toast.success("Block deleted");
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(null);
    }
  };

  const renderSpritePreview = (sprite: Sprite | undefined) => {
    if (!sprite || !sprite.frames?.[0]?.pixels) return "";
    
    const [width, height] = sprite.size.split("x").map(Number);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      sprite.frames[0].pixels.forEach((row, y) => {
        row.forEach((colorIndex, x) => {
          let color = "#000000";
          if (colorIndex > 0 && colorIndex <= 15) {
            const spectrumColors = [
              "#000000", "#0000D7", "#D70000", "#D700D7",
              "#00D700", "#00D7D7", "#D7D700", "#D7D7D7",
              "#000000", "#0000FF", "#FF0000", "#FF00FF",
              "#00FF00", "#00FFFF", "#FFFF00", "#FFFFFF"
            ];
            color = spectrumColors[colorIndex];
          }
          ctx.fillStyle = color;
          ctx.fillRect(x * 2, y * 2, 2, 2);
        });
      });
    }
    
    return canvas.toDataURL();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 auto-rows-min gap-4">
      <Card className="p-4 lg:col-span-3 rounded-lg border bg-card text-card-foreground shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-primary mb-4">Block Library</h2>

        {safeBlocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No blocks created yet</p>
            <p className="text-sm mt-2">Create blocks from sprites to use in your screens</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {safeBlocks.map((block) => (
              <Card
                key={block.id}
                className={`p-3 cursor-pointer transition-all hover:border-primary ${
                  selectedBlock?.id === block.id ? "border-primary retro-glow" : ""
                }`}
                onClick={() => setSelectedBlock(block)}
              >
                <div className="aspect-video bg-muted rounded mb-2 flex items-center justify-center">
                  {block.sprite && (
                    <img
                      src={renderSpritePreview(block.sprite)}
                      alt={block.name}
                      className="pixelated max-w-full max-h-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                </div>
                <p className="text-xs font-semibold text-center truncate">{block.name}</p>
                <p className="text-xs text-muted-foreground text-center">{block.type}</p>
                <div className="flex gap-1 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBlock(block.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>



      {/* Block Creator */}
      <Card className="p-4">
        <h2 className="text-lg font-bold text-primary mb-4">Create Block</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="block-name">Block Name</Label>
            <Input
              id="block-name"
              value={editingBlock.name || ""}
              onChange={(e) => setEditingBlock({ ...editingBlock, name: e.target.value })}
              placeholder="e.g., Wall, Floor, Coin"
            />
          </div>

          <div>
            <Label htmlFor="sprite-select">Sprite</Label>
            <Select
              value={editingBlock.sprite?.id}
              onValueChange={(spriteId) => {
                const sprite = sprites.find(s => s.id === spriteId);
                setEditingBlock({ ...editingBlock, sprite });
              }}
            >
              <SelectTrigger id="sprite-select">
                <SelectValue placeholder="Select sprite" />
              </SelectTrigger>
              <SelectContent>
                {sprites.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No sprites available. Create sprites first.
                  </div>
                ) : (
                  sprites.map((sprite) => (
                    <SelectItem key={sprite.id} value={sprite.id}>
                      {sprite.name} ({sprite.size})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="block-type">Block Type</Label>
            <Select
              value={editingBlock.type}
              onValueChange={(type) => {
                // Reset properties when type changes
                setEditingBlock({ 
                  ...editingBlock, 
                  type: type as BlockType,
                  properties: {}
                });
              }}
            >
              <SelectTrigger id="block-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-semibold">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Block Type Properties */}
          {editingBlock.type === "crumbling" && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label htmlFor="crumbleTime">Crumble Time (seconds)</Label>
                <Input
                  id="crumbleTime"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={editingBlock.properties?.crumbleTime ?? 1}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, crumbleTime: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div>
                <Label htmlFor="respawnTime">Respawn Time (seconds, optional)</Label>
                <Input
                  id="respawnTime"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Leave empty for no respawn"
                  value={editingBlock.properties?.respawnTime ?? ""}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, respawnTime: e.target.value ? parseFloat(e.target.value) : undefined }
                  })}
                />
              </div>
            </div>
          )}

          {editingBlock.type === "sinking" && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label htmlFor="sinkingSpeed">Sinking Speed</Label>
                <Input
                  id="sinkingSpeed"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={editingBlock.properties?.sinkingSpeed ?? 1}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, sinkingSpeed: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div>
                <Label htmlFor="sinkingDepth">Sinking Depth (pixels)</Label>
                <Input
                  id="sinkingDepth"
                  type="number"
                  min="1"
                  step="1"
                  value={editingBlock.properties?.sinkingDepth ?? 8}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, sinkingDepth: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetOnPlayerDeath"
                  checked={editingBlock.properties?.resetOnPlayerDeath ?? false}
                  onCheckedChange={(checked) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, resetOnPlayerDeath: checked === true }
                  })}
                />
                <Label htmlFor="resetOnPlayerDeath" className="cursor-pointer">Reset on player death</Label>
              </div>
            </div>
          )}

          {editingBlock.type === "conveyor" && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label htmlFor="conveyorDirection">Direction</Label>
                <Select
                  value={editingBlock.properties?.direction ?? "right"}
                  onValueChange={(value) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, direction: value as "left" | "right" }
                  })}
                >
                  <SelectTrigger id="conveyorDirection">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="conveyorSpeed">Speed: {editingBlock.properties?.speed ?? 2}</Label>
                <Slider
                  id="conveyorSpeed"
                  min={1}
                  max={10}
                  step={1}
                  value={[editingBlock.properties?.speed ?? 2]}
                  onValueChange={([value]) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, speed: value }
                  })}
                />
              </div>
            </div>
          )}

          {editingBlock.type === "ice" && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label htmlFor="frictionCoefficient">Friction Coefficient: {(editingBlock.properties?.frictionCoefficient ?? 0.5).toFixed(2)}</Label>
                <Slider
                  id="frictionCoefficient"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={[editingBlock.properties?.frictionCoefficient ?? 0.5]}
                  onValueChange={([value]) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, frictionCoefficient: value }
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">0.1 = very slippery, 1.0 = normal grip</p>
              </div>
            </div>
          )}

          {editingBlock.type === "ladder" && (
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label htmlFor="climbSpeed">Climb Speed</Label>
                <Input
                  id="climbSpeed"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={editingBlock.properties?.climbSpeed ?? 2}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, climbSpeed: parseFloat(e.target.value) }
                  })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="passThroughAllowed"
                  checked={editingBlock.properties?.passThroughAllowed ?? true}
                  onCheckedChange={(checked) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, passThroughAllowed: checked === true }
                  })}
                />
                <Label htmlFor="passThroughAllowed" className="cursor-pointer">Allow pass-through</Label>
              </div>
            </div>
          )}

          <Button onClick={handleCreateBlock} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Create Block
          </Button>
        </div>
      </Card>
    </div>
  );
};
