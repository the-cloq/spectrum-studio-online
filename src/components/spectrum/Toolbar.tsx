import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Paintbrush, 
  Grid3x3, 
  Map, 
  Settings, 
  Gamepad2,
  Layers,
  Workflow
} from "lucide-react";

interface ToolbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Toolbar = ({ activeTab, onTabChange }: ToolbarProps) => {
  const tabs = [
    { value: "sprites", label: "Sprites", icon: Paintbrush },
    { value: "blocks", label: "Blocks", icon: Grid3x3 },
    { value: "screens", label: "Screens", icon: Map },
    { value: "objects", label: "Objects", icon: Gamepad2 },
    { value: "levels", label: "Levels", icon: Layers },
    { value: "gameflow", label: "Game Flow", icon: Workflow },
    { value: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <Card className="p-2 bg-card border-border">
      <div className="flex gap-1">
        {tabs.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={activeTab === value ? "default" : "ghost"}
            size="sm"
            onClick={() => onTabChange(value)}
            className="flex-1"
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
};
