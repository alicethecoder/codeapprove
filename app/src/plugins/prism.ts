/**
 * Map of file extensions to Prism lang.
 */
const LANG_MAP: Record<string, string> = {
  html: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  js: "javascript",
  c: "c",
  csharp: "csharp",
  cs: "csharp",
  cpp: "cpp",
  Dockerfile: "docker",
  ejs: "ejs",
  erb: "erb",
  rules: "firestore-security-rules",
  go: "go",
  gqp: "graphql",
  gradle: "groovy",
  h: "clike",
  hs: "haskell",
  java: "java",
  json: "javascript",
  kt: "kotlin",
  less: "less",
  ms: "markdown",
  m: "objectivec",
  php: "php",
  proto: "protobuf",
  py: "python",
  jsx: "jsx",
  tsx: "tsx",
  rb: "ruby",
  rust: "rust",
  scss: "sass",
  scala: "scala",
  sql: "sql",
  swift: "swift",
  ts: "typescript",
  vue: "markup",
  yaml: "yaml"
};

const Prism = require("prismjs");

// Require the prism plugin for each language we support
// See: https://github.com/PrismJS/prism/issues/593
if (!Prism.languages["markup-templating"]) {
  require("prismjs/components/prism-markup-templating.js");
}

// TODO(stop): Will this tree-shake properly?
for (const lang of Object.values(LANG_MAP)) {
  if (!Prism.languages[lang]) {
    require("prismjs/components/prism-" + lang + ".js");
  }
}

export function getFileLang(filename: string): string {
  const segments: string[] = filename.split(".");
  const ext: string = segments[segments.length - 1];

  const suggested = LANG_MAP[ext];
  if (suggested) {
    return suggested;
  }

  return "markup";
}
