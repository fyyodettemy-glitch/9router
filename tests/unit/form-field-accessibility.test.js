import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cn } from "../../src/shared/utils/cn.js";

const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/compiled/babel/core");

function loadComponent(name) {
  const filename = fileURLToPath(new URL(`../../src/shared/components/${name}.js`, import.meta.url));
  const { code } = transformSync(readFileSync(filename, "utf8"), {
    filename,
    babelrc: false,
    configFile: false,
    presets: [[require.resolve("next/babel"), { "preset-env": { modules: "commonjs" }, "preset-react": { runtime: "automatic" } }]],
  });
  const compiled = { exports: {} };
  const localRequire = (id) => id === "@/shared/utils/cn" ? { cn } : require(id.startsWith("@babel/runtime/") ? `next/dist/compiled/${id}` : id);
  new Function("require", "module", "exports", code)(localRequire, compiled, compiled.exports);
  return compiled.exports.default;
}

for (const name of ["Input", "Select"]) {
  const Component = loadComponent(name);
  const render = (props) => renderToStaticMarkup(React.createElement(Component, props));

  describe(`${name} accessibility`, () => {
    it("associates its label with an automatically generated control ID", () => {
      const html = render({ label: "Name" });
      const id = html.match(/<(?:input|select)[^>]* id="([^"]+)"/)[1];
      expect(html).toContain(`for="${id}"`);
    });

    it("preserves explicit IDs and descriptions while announcing errors", () => {
      const html = render({ id: "field", label: "Name", required: true, error: "Try again", hint: "Hidden hint", "aria-describedby": "context" });
      expect(html).toContain('for="field"');
      expect(html).toContain('required=""');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="context field-message"');
      expect(html).toContain('id="field-message" role="alert"');
      expect(html).not.toContain("Hidden hint");
    });

    it("describes hints without marking the field invalid", () => {
      const html = render({ id: "field", hint: "Choose a name" });
      expect(html).toContain('aria-describedby="field-message"');
      expect(html).toContain('id="field-message"');
      expect(html).not.toContain("aria-invalid");
    });
  });
}
