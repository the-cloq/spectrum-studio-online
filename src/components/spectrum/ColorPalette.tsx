import { SPECTRUM_COLORS, type SpectrumColor } from "@/types/spectrum";
import { cn } from "@/lib/utils";

interface ColorPaletteProps {
  selectedColor: SpectrumColor;
  onColorSelect: (color: SpectrumColor) => void;
  className?: string;
}

export const ColorPalette = ({ selectedColor, onColorSelect, className }: ColorPaletteProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Spectrum Palette</h3>
      <div className="grid grid-cols-8 gap-1 p-2 bg-card border border-border rounded">
        {SPECTRUM_COLORS.map((color) => (
          <button
            key={`${color.ink}-${color.bright}`}
            onClick={() => onColorSelect(color)}
            className={cn(
              "w-8 h-8 rounded border-2 transition-all hover:scale-110",
              selectedColor.ink === color.ink && selectedColor.bright === color.bright
                ? "border-primary retro-glow"
                : "border-border"
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground text-center">
        Selected: <span className="text-primary">{selectedColor.name}</span>
      </div>
    </div>
  );
};
