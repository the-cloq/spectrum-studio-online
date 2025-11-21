// ZX Spectrum image processing helpers


// Spectrum screen size
export const SPECTRUM_WIDTH = 256;
export const SPECTRUM_HEIGHT = 192;


// Attribute block size
export const ATTR_BLOCK = 8;


export async function processImageForSpectrum(img: HTMLImageElement): Promise<ImageData> {
const canvas = document.createElement("canvas");
canvas.width = SPECTRUM_WIDTH;
canvas.height = SPECTRUM_HEIGHT;


const ctx = canvas.getContext("2d")!;


// Scale + draw
ctx.drawImage(img, 0, 0, SPECTRUM_WIDTH, SPECTRUM_HEIGHT);


const imageData = ctx.getImageData(0, 0, SPECTRUM_WIDTH, SPECTRUM_HEIGHT);
const data = imageData.data;


// Process 8x8 attribute blocks
for (let by = 0; by < SPECTRUM_HEIGHT; by += ATTR_BLOCK) {
for (let bx = 0; bx < SPECTRUM_WIDTH; bx += ATTR_BLOCK) {
enforceTwoColours(data, bx, by);
}
}


ctx.putImageData(imageData, 0, 0);


return imageData;
}


function enforceTwoColours(data: Uint8ClampedArray, bx: number, by: number) {
const colours = new Map<string, number>();


for (let y = 0; y < ATTR_BLOCK; y++) {
for (let x = 0; x < ATTR_BLOCK; x++) {
const i = ((by + y) * SPECTRUM_WIDTH + (bx + x)) * 4;
const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
colours.set(key, (colours.get(key) || 0) + 1);
}
}


const sorted = [...colours.entries()].sort((a, b) => b[1] - a[1]);
const allowed = sorted.slice(0, 2).map((e) => e[0]);


for (let y = 0; y < ATTR_BLOCK; y++) {
for (let x = 0; x < ATTR_BLOCK; x++) {
const i = ((by + y) * SPECTRUM_WIDTH + (bx + x)) * 4;
const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;


if (!allowed.includes(key)) {
const [r, g, b] = allowed[0].split(",").map(Number);
data[i] = r;
data[i + 1] = g;
data[i + 2] = b;
}
}
}
}
