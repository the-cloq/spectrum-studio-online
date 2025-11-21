import React, { useRef, useState, useEffect } from "react";
import { something } from "@/components/spectrum/spectrumImageTools";


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


const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;


const img = new Image();
img.onload = () => setImage(img);
img.src = URL.createObjectURL(file);
};


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


const getMousePos = (e: React.MouseEvent) => {
const rect = canvasRef.current!.getBoundingClientRect();
return {
x: Math.floor(e.clientX - rect.left),
y: Math.floor(e.clientY - rect.top),
};
};


const handleMouseDown = (e: React.MouseEvent) => {
  const pos = getMousePos(e);
  setDragStart(pos);
  setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });  // start crop rect
  setDragging(true);
};

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
