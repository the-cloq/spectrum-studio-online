<div className="flex gap-2">
  <Button
    size="sm"
    variant={isErasing ? "default" : "outline"}
    onClick={() => setIsErasing(!isErasing)}
  >
    <Eraser className="w-4 h-4 mr-2" />Erase
  </Button>

  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      if (!selectedScreen) return;
      const clearedScreen = selectedScreen.type === "title"
        ? {
            ...selectedScreen,
            pixels: Array(192)
              .fill(null)
              .map(() =>
                Array(256).fill({ name: "Black", value: "#000000" })
              ),
          }
        : {
            ...selectedScreen,
            tiles: Array(24)
              .fill(null)
              .map(() => Array(32).fill("")),
          };
      updateScreen(clearedScreen);
      toast.success("Screen cleared!");
    }}
  >
    Clear
  </Button>
</div>
