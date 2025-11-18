import { useState, useEffect } from "react";
import { Header } from "@/components/spectrum/Header";
import { Toolbar } from "@/components/spectrum/Toolbar";
import { SpriteEditor } from "@/components/spectrum/SpriteEditor";
import { BlockDesigner } from "@/components/spectrum/BlockDesigner";
import { ScreenDesigner } from "@/components/spectrum/ScreenDesigner";
import { type GameProject, type Sprite, type Block, type Screen } from "@/types/spectrum";
import { exportGameToTAP, downloadTAPFile } from "@/lib/tapExport";
import { toast } from "sonner";

const STORAGE_KEY = "zx-spectrum-project";

const Index = () => {
  const [activeTab, setActiveTab] = useState("sprites");
  const [project, setProject] = useState<GameProject>({
    id: "project-1",
    name: "My Spectrum Game",
    sprites: [{
      id: "sprite-1",
      name: "New Sprite",
      size: "16x16",
      pixels: Array(16).fill(null).map(() => Array(16).fill(0)),
    }],
    blocks: [],
    screens: [],
    settings: {
      lives: 3,
      startEnergy: 100,
      showScore: true,
      showEnergy: true,
    },
  });

  // Load project from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        setProject(loaded);
        toast.success("Project loaded from browser storage");
      } catch (e) {
        console.error("Failed to load project:", e);
      }
    }
  }, []);

  // Auto-save project
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }, 1000);
    return () => clearTimeout(timer);
  }, [project]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleSpritesChange = (sprites: Sprite[]) => {
    setProject({ ...project, sprites });
  };

  const handleBlocksChange = (blocks: Block[]) => {
    setProject({ ...project, blocks });
  };

  const handleScreensChange = (screens: Screen[]) => {
    setProject({ ...project, screens });
  };

  const handleExportTAP = () => {
    if (project.screens.length === 0) {
      toast.error("Please create at least one screen before exporting");
      return;
    }

    try {
      const tapBlob = exportGameToTAP(project);
      downloadTAPFile(tapBlob, project.name);
      toast.success(`${project.name}.tap exported successfully!`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export TAP file");
    }
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    toast.success("Project saved!");
  };

  const handleLoad = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        setProject(loaded);
        toast.success("Project loaded!");
      } catch (e) {
        toast.error("Failed to load project");
      }
    } else {
      toast.info("No saved project found");
    }
  };

  return (
    <div className="min-h-screen bg-background crt-effect">
      <Header
        project={project}
        onExportTAP={handleExportTAP}
        onSave={handleSave}
        onLoad={handleLoad}
      />
      
      <div className="container mx-auto px-4 py-4 space-y-4">
        <Toolbar activeTab={activeTab} onTabChange={handleTabChange} />
        
        {activeTab === "sprites" && (
          <div className="space-y-4">
            <SpriteEditor
              sprite={project.sprites[0]}
              onSpriteChange={(sprite) => {
                const newSprites = [...project.sprites];
                newSprites[0] = sprite;
                handleSpritesChange(newSprites);
              }}
            />
          </div>
        )}

        {activeTab === "blocks" && (
          <BlockDesigner
            sprites={project.sprites}
            blocks={project.blocks}
            onBlocksChange={handleBlocksChange}
          />
        )}

        {activeTab === "screens" && (
          <ScreenDesigner
            blocks={project.blocks}
            screens={project.screens}
            onScreensChange={handleScreensChange}
          />
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
