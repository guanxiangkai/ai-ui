import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ui = createRequire(new URL("../packages/ui/package.json", import.meta.url));
const vueTestUtils = createRequire(ui.resolve("@vue/test-utils"));
const manifestPath = vueTestUtils.resolve("js-beautify/package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const cli = join(dirname(manifestPath), manifest.bin["js-beautify"]);

const directory = await mkdtemp(join(tmpdir(), "ai-ui-beautify-"));
try {
  await writeFile(
    join(directory, ".editorconfig"),
    "root = true\n[*]\nindent_style = space\nindent_size = 2\n",
  );
  const files = ["one.js", "two.js"];
  for (const file of files) {
    await writeFile(join(directory, file), "const result={\nanswer:1\n};\n");
  }
  execFileSync(process.execPath, [cli, "--replace", "--editorconfig", "*.js"], {
    cwd: directory,
    stdio: "inherit",
  });
  for (const file of files) {
    const formatted = await readFile(join(directory, file), "utf8");
    if (!formatted.includes("\n  answer: 1")) {
      throw new Error(`js-beautify 未按 .editorconfig 格式化 ${file}`);
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
