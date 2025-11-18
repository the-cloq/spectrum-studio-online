import { Button } from "@/components/ui/button";
import { Cpu, Download, Save, FolderOpen } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-primary retro-glow" />
          <div>
            <h1 className="text-xl font-bold text-primary tracking-wider">
              ZX SPECTRUM DESIGNER
            </h1>
            <p className="text-xs text-muted-foreground">Modern Browser Game Creator</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FolderOpen className="w-4 h-4 mr-2" />
            Open
          </Button>
          <Button variant="outline" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="default" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export TAP
          </Button>
        </div>
      </div>
    </header>
  );
};
