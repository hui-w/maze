/* Builds the release folder: minified JS and CSS, the release page and static files */
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");
const CleanCSS = require("clean-css");

const src = path.join(__dirname, "src");
const out = path.join(__dirname, "release");
const scripts = ["common.js", "config.js", "game.js", "maze.js", "path.js"];

async function build() {
  fs.mkdirSync(out, { recursive: true });

  const code = scripts
    .map((f) => fs.readFileSync(path.join(src, f), "utf8"))
    .join("\n");
  const result = await minify(code, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });

  // keep a single header comment instead of one per source file
  const header = fs
    .readFileSync(path.join(src, "common.js"), "utf8")
    .match(/^\/\*\*[\s\S]*?\*\//)[0];
  fs.writeFileSync(path.join(out, "app.min.js"), header + "\n" + result.code);

  const css = new CleanCSS().minify(
    fs.readFileSync(path.join(src, "web.css"), "utf8"),
  );
  if (css.errors.length) {
    throw new Error(css.errors.join("\n"));
  }
  fs.writeFileSync(path.join(out, "app.min.css"), css.styles);

  fs.copyFileSync(
    path.join(src, "index_release.html"),
    path.join(out, "index.html"),
  );
  fs.cpSync(path.join(src, "static"), path.join(out, "static"), {
    recursive: true,
  });

  console.log("Built " + out);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
