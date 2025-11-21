import React, { useRef, useState, useEffect } from "react";

interface Props {
  onImport: (imageData: ImageData) => void;
}

type CropRect = { x: number; y: number; w: number; h: number } | null;

export default function LoadingScreenImporter({ onImport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropRect>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const WIDTH = 512;
  const HEIGHT = 384;

  // Handle file upload, create image and load into state
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  };

  // Draw image and crop rectangle on canvas
  useEffect(() => {
    if (!image) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    if (crop) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    }
  }, [image, crop]);

  // Convert mouse event to canvas-relative position
  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.floor(e.clientX - rect.left),
      y: Math.floor(e.clientY - rect.top),
    };
  };

  // Start crop rectangle on mouse down
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    setDragStart(pos);
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setDragging(true);
  };

  // Update crop rectangle on mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart) return;
    const pos = getMousePos(e);
    setCrop({
      x: dragStart.x,
      y: dragStart.y,
      w: pos.x - dragStart.x,
      h: pos.y - dragStart.y,
    });
  };

  // Finish dragging on mouse up
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragging) return;
    setDragging(false);

    if (!crop || !image || !canvasRef.current) return;

    // Get image data of crop region
    const ctx = canvasRef.current.getContext("2d")!;
    const imageData = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);

    onImport(imageData);
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileUpload} />
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ border: "1px solid black", cursor: "crosshair" }}
      />
    </div>
  );
}
