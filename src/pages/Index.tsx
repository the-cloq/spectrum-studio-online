import { useState } from "react";
import { Header } from "@/components/spectrum/Header";
import { Toolbar } from "@/components/spectrum/Toolbar";
import { SpriteEditor } from "@/components/spectrum/SpriteEditor";
import { type Sprite } from "@/types/spectrum";
import { toast } from "sonner";

const Index = () => {
  const [activeTab, setActiveTab] = useState("sprites");
  const [currentSprite, setCurrentSprite] = useState<Sprite>({
    id: "sprite-1",
    name: "New Sprite",
    size: "16x16",
    pixels: Array(16).fill(null).map(() => Array(16).fill(0)),
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    toast.info(`Switched to ${tab} editor`);
  };

  const handleSpriteChange = (sprite: Sprite) => {
    setCurrentSprite(sprite);
  };

  return (
    <div className="min-h-screen bg-background crt-effect">
      <Header />
      
      <div className="container mx-auto px-4 py-4 space-y-4">
        <Toolbar activeTab={activeTab} onTabChange={handleTabChange} />
        
        {activeTab === "sprites" && (
          <SpriteEditor
            sprite={currentSprite}
            onSpriteChange={handleSpriteChange}
          />
        )}

        {activeTab === "blocks" && (
          <div className="p-8 text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-primary mb-2">Block Designer</h2>
            <p>Create tiles and blocks for your game levels</p>
            <p className="text-sm mt-4">Coming soon...</p>
          </div>
        )}

        {activeTab === "screens" && (
          <div className="p-8 text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-primary mb-2">Screen Designer</h2>
            <p>Design game screens and arrange tiles</p>
            <p className="text-sm mt-4">Coming soon...</p>
          </div>
        )}

        {activeTab === "objects" && (
          <div className="p-8 text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-primary mb-2">Game Objects</h2>
            <p>Configure enemies, collectibles, and interactive elements</p>
            <p className="text-sm mt-4">Coming soon...</p>
          </div>
        )}

        {activeTab === "levels" && (
          <div className="p-8 text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-primary mb-2">Level Editor</h2>
            <p>Arrange screens and create game progression</p>
            <p className="text-sm mt-4">Coming soon...</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-8 text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-primary mb-2">Game Settings</h2>
            <p>Configure lives, score, energy, and game rules</p>
            <p className="text-sm mt-4">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
