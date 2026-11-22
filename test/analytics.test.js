const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const page = fs.readFileSync(
  path.join(__dirname, "..", "src", "index_release.html"),
  "utf8",
);
const inlineScript = page.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function loadAnalytics(url) {
  const scripts = [];
  const window = { location: new URL(url) };
  vm.runInNewContext(inlineScript, {
    window,
    document: {
      createElement: () => ({}),
      head: { appendChild: (element) => scripts.push(element) },
    },
  });
  return { scripts, dataLayer: window.dataLayer };
}

test("analytics is not loaded on local origins", () => {
  for (const url of [
    "http://localhost:8123/",
    "http://app.localhost:8123/",
    "http://localhost.:8123/",
    "http://127.0.0.1:8123/",
    "http://127.0.0.2:8123/",
    "http://[::1]:8123/",
    "file:///index.html",
  ]) {
    const result = loadAnalytics(url);
    assert.equal(result.scripts.length, 0, url);
    assert.equal(result.dataLayer, undefined, url);
  }
});

test("analytics is loaded on non-local origins", () => {
  for (const url of ["https://www.qlike.com/", "http://192.168.1.10:8123/"]) {
    const result = loadAnalytics(url);
    assert.equal(result.scripts.length, 1, url);
    assert.equal(result.scripts[0].async, true, url);
    assert.equal(
      result.scripts[0].src,
      "https://www.googletagmanager.com/gtag/js?id=G-P58ZW4448P",
      url,
    );
    assert.equal(result.dataLayer.length, 2, url);
    assert.equal(result.dataLayer[1][0], "config", url);
    assert.equal(result.dataLayer[1][1], "G-P58ZW4448P", url);
  }
});
