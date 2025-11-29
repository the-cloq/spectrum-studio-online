import { Button } from "@/components/ui/button";
import { Cpu, Download, Save } from "lucide-react";
import { type GameProject } from "@/types/spectrum";
import { useProjectState } from "@/contexts/ProjectStateContext";
import { cn } from "@/lib/utils";

interface HeaderProps {
  project: GameProject;
  onExportTAP: () => void;
}

export const Header = ({ project, onExportTAP }: HeaderProps) => {
  const { dirtyCount, isSaving, justSaved, saveToSupabase } = useProjectState();
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-primary retro-glow" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-wider">
              ZX SPECTRUM DESIGNER
            </h1>
            <p className="text-xs text-muted-foreground">
              {project.name || "Modern Browser Game Creator"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {dirtyCount > 15 && !isSaving && !justSaved && (
            <div className="text-sm text-muted-foreground animate-pulse">
              You have unsaved changes
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveToSupabase}
            disabled={isSaving}
            className={cn(
              "transition-colors",
              justSaved && "border-green-500 text-green-500"
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-muted border-t-primary rounded-full animate-spin" />
                Saving...
              </>
            ) : justSaved ? (
              <>
                <span className="mr-2">✓</span>
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
          
          <Button variant="default" size="sm" onClick={onExportTAP}>
            <Download className="w-4 h-4 mr-2" />
            Export TAP
          </Button>
        </div>
      </div>
    </header>
  );
};
