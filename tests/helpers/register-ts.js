const fs = require("fs");
const ts = require("typescript");

const defaultOptions = {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    jsx: ts.JsxEmit.React,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    resolveJsonModule: true,
  },
};

require.extensions[".ts"] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, defaultOptions);
  module._compile(outputText, filename);
};
