import fs from "fs";
import path from "path";
import process from "process";

const getFiles = (dir) => {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
};

const fixDuplicateSx = (filePath) => {
  if (!filePath.endsWith(".jsx") && !filePath.endsWith(".tsx")) return;
  
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  // Regex to find components with multiple sx props
  // Example: <Stack sx={{ a: 1 }} spacing={1} sx={{ b: 2 }}>
  // We'll replace it by merging the contents of the sx objects
  const rx = /(sx=\{\{[\s\S]*?\}\})\s+([^>]*?)(sx=\{\{[\s\S]*?\}\})/g;
  
  // To handle multiple times (e.g. 3 sx props), we run it in a loop
  while (rx.test(content)) {
    content = content.replace(rx, (match, sx1, middle, sx2) => {
      // Extract contents inside {{ ... }}
      const inner1 = sx1.slice(5, -2).trim();
      const inner2 = sx2.slice(5, -2).trim();
      
      const mergedSx = `sx={{ ${inner1}, ${inner2} }}`;
      return `${mergedSx} ${middle}`.replace(/\s+/g, ' ');
    });
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`Fixed: ${filePath}`);
  }
};

const files = getFiles(path.resolve(process.cwd(), "src"));
files.forEach(fixDuplicateSx);
console.log("Done.");
