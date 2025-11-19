import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { type Block, type Sprite, type BlockType } from "@/types/spectrum";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface BlockDesignerProps {
  sprites: Sprite[];
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
}

const BLOCK_TYPES: { value: BlockType; label: string; description: string }[] = [
  { value: "empty", label: "Empty", description: "No collision" },
  { value: "solid", label: "Solid", description: "Blocks movement" },
  { value: "deadly", label: "Deadly", description: "Kills player on contact" },
  { value: "collectible", label: "Collectible", description: "Can be picked up" },
  { value: "platform", label: "Platform", description: "Can stand on top" },
  { value: "sinking", label: "Sinking", description: "Sinks when stepped on" },
  { value: "crumbling", label: "Crumbling", description: "Breaks after standing" },
  { value: "conveyor-left", label: "Conveyor Left", description: "Moves player left" },
  { value: "conveyor-right", label: "Conveyor Right", description: "Moves player right" },
];

export const BlockDesigner = ({ sprites, blocks, onBlocksChange }: BlockDesignerProps) => {
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [editingBlock, setEditingBlock] = useState<Partial<Block>>({
    name: "",
    type: "solid",
    properties: {
      solid: true,
      deadly: false,
      collectible: false,
      points: 0,
      energy: 0,
    },
  });

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

    onBlocksChange([...blocks, newBlock]);
    toast.success(`Block "${newBlock.name}" created!`);
    
    // Reset form
    setEditingBlock({
      name: "",
      type: "solid",
      properties: { solid: true },
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(b => b.id !== blockId));
    toast.success("Block deleted");
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(null);
    }
  };

  const renderSpritePreview = (sprite: Sprite) => {
    const [width, height] = sprite.size.split("x").map(Number);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      sprite.pixels.forEach((row, y) => {
        row.forEach((colorIndex, x) => {
          // Use actual Spectrum colors from the palette
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Block Library */}
      <Card className="p-4 lg:col-span-2">
        <h2 className="text-lg font-bold text-primary mb-4">Block Library</h2>
        
        {blocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No blocks created yet</p>
            <p className="text-sm mt-2">Create blocks from sprites to use in your screens</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {blocks.map((block) => (
              <Card
                key={block.id}
                className={`p-3 cursor-pointer transition-all hover:border-primary ${
                  selectedBlock?.id === block.id ? "border-primary retro-glow" : ""
                }`}
                onClick={() => setSelectedBlock(block)}
              >
                <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center">
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
                {sprites.map((sprite) => (
                  <SelectItem key={sprite.id} value={sprite.id}>
                    {sprite.name} ({sprite.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="block-type">Block Type</Label>
            <Select
              value={editingBlock.type}
              onValueChange={(type) => setEditingBlock({ ...editingBlock, type: type as BlockType })}
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

          {editingBlock.type === "collectible" && (
            <>
              <div>
                <Label htmlFor="points">Points Value</Label>
                <Input
                  id="points"
                  type="number"
                  value={editingBlock.properties?.points || 0}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, points: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div>
                <Label htmlFor="energy">Energy Value</Label>
                <Input
                  id="energy"
                  type="number"
                  value={editingBlock.properties?.energy || 0}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    properties: { ...editingBlock.properties, energy: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </>
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
