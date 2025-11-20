// LevelDesigner.tsx
import React, { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { Grip, Plus } from "lucide-react";

interface Screen {
  id: string;
  name: string;
}

interface Level {
  id: string;
  name: string;
  screenIds: string[];
}

// Example screens – replace with your real screens
const MOCK_SCREENS: Screen[] = [
  { id: "s1", name: "Screen 1" },
  { id: "s2", name: "Screen 2" },
  { id: "s3", name: "Screen 3" },
];

export function LevelDesigner() {
  const [screens] = useState<Screen[]>(MOCK_SCREENS);
  const [levels, setLevels] = useState<Level[]>([]);
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const [selectedScreens, setSelectedScreens] = useState<string[]>([]);
  const [levelName, setLevelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleScreen = (id: string) => {
    setSelectedScreens((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // Step 1: create level view
  const createLevelFromSelection = () => {
    if (selectedScreens.length === 0) return;

    const newLevel: Level = {
      id: `${Date.now()}`,
      name: levelName || `Level ${levels.length + 1}`,
      screenIds: [...selectedScreens],
    };

    setActiveLevel(newLevel);
    setIsCreating(false);
    setSelectedScreens([]);
    setLevelName("");
  };

  // Step 2: save active level to grid
  const saveActiveLevel = () => {
    if (!activeLevel) return;
    setLevels((prev) => [...prev, activeLevel]);
    setActiveLevel(null);
  };

  return (
    <div className="p-6 space-y-6">
      {!activeLevel && !isCreating && (
        <>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white"
          >
            <Plus size={16} /> Create Level
          </button>

          {levels.length > 0 && (
            <Reorder.Group
              axis="y"
              values={levels}
              onReorder={setLevels}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4"
            >
              {levels.map((level, idx) => (
                <Reorder.Item
                  key={level.id}
                  value={level}
                  className="bg-white border rounded-2xl shadow p-4 cursor-grab"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Grip size={16} />
                    <h3 className="font-semibold text-sm flex-1">{level.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                      Level {idx + 1}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {level.screenIds.map((sid) => {
                      const sc = screens.find((s) => s.id === sid);
                      return (
                        <div
                          key={sid}
                          className="flex-1 text-center text-xs bg-gray-50 border rounded p-2"
                        >
                          {sc?.name}
                        </div>
                      );
                    })}
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </>
      )}

      {/* Step 1: screen selection */}
      {isCreating && !activeLevel && (
        <div className="space-y-4 border rounded-2xl p-4">
          <h2 className="font-semibold text-lg">Create New Level</h2>

          <input
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            placeholder="Level name"
            className="border rounded w-full p-2"
          />

          <div className="grid grid-cols-2 gap-2">
            {screens.map((screen) => (
              <button
                key={screen.id}
                onClick={() => toggleScreen(screen.id)}
                className={`p-3 rounded-xl border text-left ${
                  selectedScreens.includes(screen.id)
                    ? "bg-black text-white"
                    : "bg-white"
                }`}
              >
                {screen.name}
              </button>
            ))}
          </div>

          <button
            onClick={createLevelFromSelection}
            disabled={selectedScreens.length === 0}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
          >
            Create Level View
          </button>
        </div>
      )}

      {/* Step 2: active level view */}
      {activeLevel && (
        <div className="space-y-4 border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Grip size={16} />
            <h2 className="font-semibold">{activeLevel.name}</h2>
          </div>

          <Reorder.Group
            axis="x"
            values={activeLevel.screenIds}
            onReorder={(newOrder) =>
              setActiveLevel({ ...activeLevel, screenIds: newOrder })
            }
            className="flex gap-4 overflow-x-auto"
          >
            {activeLevel.screenIds.map((sid) => {
              const sc = screens.find((s) => s.id === sid);
              return (
                <Reorder.Item
                  key={sid}
                  value={sid}
                  className="min-w-[140px] border rounded-xl p-4 cursor-grab"
                >
                  <div className="text-sm font-medium mb-1">{sc?.name}</div>
                  <div className="text-xs text-gray-500">Drag left/right</div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <button
            onClick={saveActiveLevel}
            className="px-4 py-2 rounded-xl bg-black text-white"
          >
            Save Level
          </button>
        </div>
      )}
    </div>
  );
}
