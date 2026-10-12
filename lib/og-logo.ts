import { readFile } from "fs/promises";
import path from "path";

export async function generaLogoDataUri(): Promise<string> {
  const buf = await readFile(
    path.join(process.cwd(), "public", "brand", "logo-genera-mark.png")
  );
  return `data:image/png;base64,${buf.toString("base64")}`;
}
