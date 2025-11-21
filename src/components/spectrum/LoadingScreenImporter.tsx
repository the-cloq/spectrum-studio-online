import React, { useRef, useState, useEffect } from "react";
const tempCanvas = document.createElement("canvas");


tempCanvas.width = crop.w;
tempCanvas.height = crop.h;


const tctx = tempCanvas.getContext("2d")!;
tctx.drawImage(
srcCanvas,
crop.x,
crop.y,
crop.w,
crop.h,
0,
0,
crop.w,
crop.h
);


const imageData = tctx.getImageData(0, 0, crop.w, crop.h);
const spectrumData = spectrumConvertImage(imageData);


onImport(spectrumData);
};


return (
<div className="space-y-3 p-4 border rounded">
<h3 className="font-bold uppercase text-xs text-muted-foreground">
ZX Spectrum Loading Screen Importer
</h3>


<input type="file" accept="image/*" onChange={handleFileUpload} />


<div className="border mt-2 inline-block">
<canvas
ref={canvasRef}
width={WIDTH}
height={HEIGHT}
className="cursor-crosshair bg-black"
onMouseDown={handleMouseDown}
onMouseMove={handleMouseMove}
onMouseUp={handleMouseUp}
/>
</div>


<div className="flex gap-2 mt-2">
<button
onClick={handleCropAndConvert}
className="px-3 py-1 bg-primary text-white text-xs rounded"
>
Crop & Convert
</button>
</div>
</div>
);
}
