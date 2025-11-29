import { useState } from "react";
import { Header } from "@/components/spectrum/Header";
import { Toolbar } from "@/components/spectrum/Toolbar";
import { SpriteEditor } from "@/components/spectrum/SpriteEditor";
import { BlockDesigner } from "@/components/spectrum/BlockDesigner";
import { ScreenDesigner } from "@/components/spectrum/ScreenDesigner";
import { type Sprite, type Block, type Screen, type Level, type GameObject, type GameFlowScreen } from "@/types/spectrum";
import { ObjectLibrary } from "@/components/spectrum/ObjectLibrary";
import { LevelDesigner } from "@/components/spectrum/LevelDesigner";
import { GameFlowDesigner } from "@/components/spectrum/GameFlowDesigner";
import { exportGameToTAP, downloadTAPFile } from "@/lib/tapExport";
import { toast } from "sonner";
import { useProjectState } from "@/contexts/ProjectStateContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("sprites");
  const { project, updateProject } = useProjectState();

  const handleTabChange = (tab: string) => setActiveTab(tab);
  const handleSpritesChange = (sprites: Sprite[]) => updateProject((prev) => ({ ...prev, sprites }));
  const handleBlocksChange = (blocks: Block[]) => updateProject((prev) => ({ ...prev, blocks }));
  const handleScreensChange = (screens: Screen[]) => updateProject((prev) => ({ ...prev, screens }));
  const handleLevelsChange = (levels: Level[]) => updateProject((prev) => ({ ...prev, levels }));
  const handleObjectsChange = (objects: GameObject[]) => updateProject((prev) => ({ ...prev, objects }));
  const handleGameFlowChange = (gameFlow: GameFlowScreen[]) => updateProject((prev) => ({ ...prev, gameFlow }));

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

  return (
    <div className="min-h-screen bg-background crt-effect">
      <Header
        project={project}
        onExportTAP={handleExportTAP}
      />
      
      <div className="container mx-auto px-4 py-4 space-y-4">
        <Toolbar activeTab={activeTab} onTabChange={handleTabChange} />
        
        {activeTab === "sprites" && <SpriteEditor sprites={project.sprites} onSpritesChange={handleSpritesChange} />}
        {activeTab === "blocks" && <BlockDesigner sprites={project.sprites} blocks={project.blocks} onBlocksChange={handleBlocksChange} />}
        {activeTab === "screens" && <ScreenDesigner blocks={project.blocks} objects={project.objects} sprites={project.sprites} screens={project.screens} onScreensChange={handleScreensChange} />}
        {activeTab === "objects" && <ObjectLibrary objects={project.objects} sprites={project.sprites} onObjectsChange={handleObjectsChange} />}
        {activeTab === "levels" && <LevelDesigner levels={project.levels} screens={project.screens} blocks={project.blocks} objects={project.objects} sprites={project.sprites} onLevelsChange={handleLevelsChange} />}
        {activeTab === "gameflow" && <GameFlowDesigner screens={project.screens} blocks={project.blocks} levels={project.levels} objects={project.objects} sprites={project.sprites} gameFlow={project.gameFlow} onGameFlowChange={handleGameFlowChange} projectName={project.name} />}
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
