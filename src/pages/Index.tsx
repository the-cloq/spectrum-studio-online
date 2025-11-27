import { useState, useEffect } from "react";
import { Header } from "@/components/spectrum/Header";
import { Toolbar } from "@/components/spectrum/Toolbar";
import { SpriteEditor } from "@/components/spectrum/SpriteEditor";
import { BlockDesigner } from "@/components/spectrum/BlockDesigner";
import { ScreenDesigner } from "@/components/spectrum/ScreenDesigner";
import { type GameProject, type Sprite, type Block, type Screen, type Level, type GameObject, type GameFlowScreen } from "@/types/spectrum";
import { ObjectLibrary } from "@/components/spectrum/ObjectLibrary";
import { LevelDesigner } from "@/components/spectrum/LevelDesigner";
import { GameFlowDesigner } from "@/components/spectrum/GameFlowDesigner";
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
      frames: [{ pixels: Array(16).fill(null).map(() => Array(16).fill(0)) }],
      animationSpeed: 4,
    }],
    objects: [],
    blocks: [],
    screens: [],
    levels: [],
    gameFlow: [],
    settings: {
      lives: 3,
      startEnergy: 100,
      showScore: true,
      showEnergy: true,
    },
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        const migratedSprites = loaded.sprites?.map((sprite: any) => {
          if (sprite.pixels && !sprite.frames) {
            return {
              ...sprite,
              frames: [{ pixels: sprite.pixels }],
              animationSpeed: sprite.animationSpeed ?? 4,
              pixels: undefined,
            };
          }
          return sprite;
        }) || [];
        
        // Ensure screens array is properly loaded
        const migratedScreens = loaded.screens?.map((screen: any) => ({
          ...screen,
          pixels: screen.pixels || undefined,
          tiles: screen.tiles || undefined,
          placedObjects: screen.placedObjects || []
        })) || [];
        
        const loadedWithDefaults = {
          ...loaded,
          sprites: migratedSprites,
          screens: migratedScreens,
          objects: loaded.objects ?? [],
          levels: loaded.levels ?? [],
          gameFlow: loaded.gameFlow ?? [],
        };
        setProject(loadedWithDefaults);
        
        const screenCount = migratedScreens.length;
        const loadingScreenCount = migratedScreens.filter((s: any) => s.type === "loading").length;
        console.log(`Loaded ${screenCount} screens (${loadingScreenCount} loading screens)`);
        
        toast.success("Project loaded from browser storage");
      } catch (e) {
        console.error("Failed to load project:", e);
        toast.error("Failed to load project from storage");
      }
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const json = JSON.stringify(project);
        localStorage.setItem(STORAGE_KEY, json);
        console.log(`Auto-saved project with ${project.screens.length} screens (${project.screens.filter(s => s.type === "loading").length} loading screens)`);
      } catch (e) {
        console.error("Failed to save project to localStorage:", e);
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          toast.error("Storage quota exceeded. Consider reducing project size.");
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [project]);

  const handleTabChange = (tab: string) => setActiveTab(tab);
  const handleSpritesChange = (sprites: Sprite[]) => setProject({ ...project, sprites });
  const handleBlocksChange = (blocks: Block[]) => setProject({ ...project, blocks });
  const handleScreensChange = (screens: Screen[]) => setProject({ ...project, screens });
  const handleLevelsChange = (levels: Level[]) => setProject({ ...project, levels });
  const handleObjectsChange = (objects: GameObject[]) => setProject({ ...project, objects });
  const handleGameFlowChange = (gameFlow: GameFlowScreen[]) => setProject({ ...project, gameFlow });

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      console.log(`Manually saved project with ${project.screens.length} screens (${project.screens.filter(s => s.type === "loading").length} loading screens)`);
      toast.success("Project saved!");
    } catch (e) {
      console.error("Failed to save project:", e);
      toast.error("Failed to save project");
    }
  };

  const handleLoad = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        
        // Ensure screens array is properly loaded
        const migratedScreens = loaded.screens?.map((screen: any) => ({
          ...screen,
          pixels: screen.pixels || undefined,
          tiles: screen.tiles || undefined,
          placedObjects: screen.placedObjects || []
        })) || [];
        
        const loadedWithDefaults = {
          ...loaded,
          screens: migratedScreens,
          objects: loaded.objects ?? [],
          levels: loaded.levels ?? [],
          gameFlow: loaded.gameFlow ?? [],
        };
        setProject(loadedWithDefaults);
        
        const screenCount = migratedScreens.length;
        const loadingScreenCount = migratedScreens.filter((s: any) => s.type === "loading").length;
        console.log(`Loaded ${screenCount} screens (${loadingScreenCount} loading screens)`);
        
        toast.success("Project loaded!");
      } catch (e) {
        console.error("Failed to load project:", e);
        toast.error("Failed to load project");
      }
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
        
        {activeTab === "sprites" && <SpriteEditor sprites={project.sprites} onSpritesChange={handleSpritesChange} />}
        {activeTab === "blocks" && <BlockDesigner sprites={project.sprites} blocks={project.blocks} onBlocksChange={handleBlocksChange} />}
        {activeTab === "screens" && <ScreenDesigner blocks={project.blocks} objects={project.objects} sprites={project.sprites} screens={project.screens} onScreensChange={handleScreensChange} />}
        {activeTab === "objects" && <ObjectLibrary objects={project.objects} sprites={project.sprites} onObjectsChange={handleObjectsChange} />}
        {activeTab === "levels" && <LevelDesigner levels={project.levels} screens={project.screens} blocks={project.blocks} objects={project.objects} sprites={project.sprites} onLevelsChange={handleLevelsChange} />}
        {activeTab === "gameflow" && <GameFlowDesigner screens={project.screens} blocks={project.blocks} gameFlow={project.gameFlow} onGameFlowChange={handleGameFlowChange} />}
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
