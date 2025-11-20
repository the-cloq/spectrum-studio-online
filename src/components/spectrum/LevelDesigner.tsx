{levels.map((level, index) => {
            const screensForLevel = level.screenIds
              .map(id => screens.find(s => s.id === id))
              .filter(Boolean) as Screen[];

            const currentScreenIndex = screenIndices[level.id] ?? 0;

            return (
              <Card
                key={level.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative p-4 border rounded flex flex-col gap-2 cursor-move group ${
                  draggingIndex === index ? "opacity-50" : ""
                }`}
              >
                {/* Top Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4" />
                    <span>{level.name}</span>
                  </div>
                  <Badge>{index + 1}</Badge>
                </div>

                {/* Screen Carousel */}
                {screensForLevel.length > 0 ? (
                  <div className="relative w-full pt-[75%] bg-muted rounded overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <canvas
                        width={256}
                        height={192}
                        className="w-full h-full bg-gray-900"
                        ref={canvas => {
                          if (!canvas) return;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;
                          const screen = screensForLevel[currentScreenIndex];
                          ctx.fillStyle = "#000";
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.fillStyle = "#fff";
                          ctx.font = "16px monospace";
                          ctx.textAlign = "center";
                          ctx.fillText(screen.name, canvas.width / 2, canvas.height / 2);
                        }}
                      />
                      {screensForLevel.length > 1 && (
                        <>
                          <button
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); prevScreen(level.id, screensForLevel); }}
                          >
                            ◀
                          </button>
                          <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                            onClick={e => { e.stopPropagation(); nextScreen(level.id, screensForLevel); }}
                          >
                            ▶
                          </button>
                        </>
                      )}
                      <div className="absolute bottom-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                        {screensForLevel[currentScreenIndex].name} (
                        {screensForLevel[currentScreenIndex].type})
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full pt-[75%] bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                    No screens
                  </div>
                )}

                {/* Delete Level */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteLevel(level.id)}
                  className="mt-2"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </Card>
            );
          })}
