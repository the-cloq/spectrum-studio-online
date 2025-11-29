import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { type GameProject, SPECTRUM_COLORS } from "@/types/spectrum";
import { supabase } from "@/supabase";
import { toast } from "sonner";

const STORAGE_KEY = "zx-spectrum-project";
const AUTO_SAVE_DELAY = 120000; // 2 minutes in milliseconds

// Compress project before saving
const serializeProjectForStorage = (project: GameProject) => {
  const serializedScreens = project.screens.map((screen) => {
    let pixels: number[][] | undefined;

    if (screen.pixels) {
      pixels = screen.pixels.map((row) =>
        row.map((color) => {
          if (!color) return -1;
          const idx = SPECTRUM_COLORS.findIndex(
            (c) =>
              c.value === color.value &&
              c.ink === color.ink &&
              c.bright === color.bright
          );
          return idx >= 0 ? idx : 0;
        })
      );
    }

    return {
      ...screen,
      pixels,
    };
  });

  return {
    ...project,
    screens: serializedScreens,
  };
};

// Expand project loaded from storage
const hydrateProjectFromStorage = (loaded: any): GameProject => {
  const migratedSprites =
    loaded.sprites?.map((sprite: any) => {
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

  const migratedScreens = (loaded.screens ?? []).map((screen: any) => {
    let pixels = screen.pixels;

    if (pixels && Array.isArray(pixels) && pixels.length > 0 && Array.isArray(pixels[0])) {
      const first = pixels[0][0];
      if (typeof first === "number") {
        pixels = pixels.map((row: number[]) =>
          row.map((idx: number) => {
            if (idx < 0 || idx >= SPECTRUM_COLORS.length) return undefined;
            return SPECTRUM_COLORS[idx];
          })
        );
      }
    }

    return {
      ...screen,
      pixels,
      tiles:
        screen.tiles ||
        (screen.type === "game"
          ? Array(24)
              .fill(null)
              .map(() => Array(32).fill(""))
          : undefined),
      placedObjects: screen.placedObjects || [],
    };
  });

  return {
    ...loaded,
    sprites: migratedSprites,
    screens: migratedScreens,
    objects: loaded.objects ?? [],
    blocks: loaded.blocks ?? [],
    levels: loaded.levels ?? [],
    gameFlow: loaded.gameFlow ?? [],
    settings:
      loaded.settings ?? {
        lives: 3,
        startEnergy: 100,
        showScore: true,
        showEnergy: true,
      },
  };
};

interface ProjectStateContextType {
  project: GameProject;
  dirtyCount: number;
  isSaving: boolean;
  justSaved: boolean;
  updateProject: (updater: (prev: GameProject) => GameProject) => void;
  saveToSupabase: () => Promise<void>;
}

const ProjectStateContext = createContext<ProjectStateContextType | undefined>(undefined);

export const useProjectState = () => {
  const context = useContext(ProjectStateContext);
  if (!context) {
    throw new Error("useProjectState must be used within ProjectStateProvider");
  }
  return context;
};

export const ProjectStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const [dirtyCount, setDirtyCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage on mount (fallback to Supabase if empty)
  useEffect(() => {
    const loadProject = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      
      if (saved) {
        try {
          const loaded = JSON.parse(saved);
          const hydrated = hydrateProjectFromStorage(loaded);
          setProject(hydrated);
          toast.success("Project loaded from browser storage");
          return;
        } catch (e) {
          console.error("Failed to load from localStorage:", e);
        }
      }

      // Fallback to Supabase
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("data")
          .eq("id", "project-1")
          .single();

        if (error) throw error;
        
        if (data?.data) {
          const hydrated = hydrateProjectFromStorage(data.data);
          setProject(hydrated);
          
          // Save to localStorage for next time
          const serialized = serializeProjectForStorage(hydrated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
          
          toast.success("Project loaded from cloud");
        }
      } catch (e) {
        console.error("Failed to load from Supabase:", e);
      }
    };

    loadProject();
  }, []);

  // Save to localStorage on every change (instant)
  useEffect(() => {
    try {
      const serialized = serializeProjectForStorage(project);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  }, [project]);

  const saveToSupabaseInternal = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);

    try {
      const serialized = serializeProjectForStorage(project);
      
      const { error } = await supabase
        .from("projects")
        .upsert({
          id: project.id,
          data: serialized,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setDirtyCount(0);
      setJustSaved(true);
      toast.success("Project saved to cloud");

      setTimeout(() => {
        setJustSaved(false);
      }, 1500);
    } catch (e) {
      console.error("Failed to save to Supabase:", e);
      toast.error("Failed to save to cloud");
    } finally {
      setIsSaving(false);
    }
  }, [project, isSaving]);

  // Auto-save to Supabase after inactivity
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (dirtyCount > 0) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveToSupabaseInternal();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [dirtyCount, saveToSupabaseInternal]);

  const updateProject = useCallback((updater: (prev: GameProject) => GameProject) => {
    setProject((prev) => {
      const updated = updater(prev);
      setDirtyCount((count) => count + 1);
      return updated;
    });
  }, []);

  const saveToSupabase = useCallback(async () => {
    await saveToSupabaseInternal();
  }, [saveToSupabaseInternal]);

  const value: ProjectStateContextType = {
    project,
    dirtyCount,
    isSaving,
    justSaved,
    updateProject,
    saveToSupabase,
  };

  return (
    <ProjectStateContext.Provider value={value}>
      {children}
    </ProjectStateContext.Provider>
  );
};
