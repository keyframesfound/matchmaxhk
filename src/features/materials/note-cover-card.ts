/**
 * A plain cover picture for notes without a PDF or photo (Word / PPT /
 * other files only), so the Carousell-style browse card always has an
 * image (#557 / #543 cover lock). Drawn in the browser: title, curriculum
 * and subject, and the file formats included. Flat MatchMax look.
 */
export async function renderCoverCard(input: {
  title: string;
  subtitle: string;
  formats: string[];
}): Promise<File> {
  const size = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#f3f6fb";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#1f3a68";
  ctx.fillRect(0, 0, size, 18);

  const font = (weight: number, px: number) =>
    `${weight} ${px}px Inter, "Noto Sans TC", "PingFang TC", Arial, sans-serif`;

  // Title, wrapped to at most 5 lines (works for CJK without spaces too).
  ctx.fillStyle = "#0f1b2d";
  ctx.font = font(700, 68);
  const maxWidth = size - 160;
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(input.title.trim())) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 5);
  if (lines.length > 5) shown[4] = `${shown[4].slice(0, -1)}…`;
  let y = 250;
  for (const l of shown) {
    ctx.fillText(l, 80, y);
    y += 86;
  }

  if (input.subtitle) {
    ctx.fillStyle = "#45618f";
    ctx.font = font(600, 40);
    ctx.fillText(input.subtitle, 80, y + 30, maxWidth);
  }

  // Format pills along the bottom.
  ctx.font = font(600, 34);
  let x = 80;
  for (const format of input.formats.slice(0, 4)) {
    const w = ctx.measureText(format).width + 48;
    if (x + w > size - 80) break;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#c9d5e8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, size - 190, w, 70, 35);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f3a68";
    ctx.fillText(format, x + 24, size - 143);
    x += w + 16;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob) throw new Error("Could not create the cover picture.");
  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}
