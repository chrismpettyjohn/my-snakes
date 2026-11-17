/** Center-crop to a square JPEG data URL so photos stay small enough to store inline. */
export async function toThumb(file: File, size = 320): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.82);
}
