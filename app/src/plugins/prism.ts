const Prism = require("prismjs");
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

// Require the prism plugin for each language we support
// See: https://github.com/PrismJS/prism/issues/593
require("prismjs/components/prism-c.js");
require("prismjs/components/prism-clike.js");
require("prismjs/components/prism-cpp.js");
require("prismjs/components/prism-csharp.js");
require("prismjs/components/prism-css.js");
require("prismjs/components/prism-docker.js");
require("prismjs/components/prism-ejs.js");
require("prismjs/components/prism-erb.js");
require("prismjs/components/prism-firestore-security-rules.js");
require("prismjs/components/prism-go.js");
require("prismjs/components/prism-graphql.js");
require("prismjs/components/prism-groovy.js");
require("prismjs/components/prism-haskell.js");
require("prismjs/components/prism-java.js");
require("prismjs/components/prism-javascript.js");
require("prismjs/components/prism-jsx.js");
require("prismjs/components/prism-kotlin.js");
require("prismjs/components/prism-less.js");
require("prismjs/components/prism-markdown.js");
require("prismjs/components/prism-markup.js");
require("prismjs/components/prism-markup-templating.js");
require("prismjs/components/prism-objectivec.js");
require("prismjs/components/prism-php.js");
require("prismjs/components/prism-protobuf.js");
require("prismjs/components/prism-python.js");
require("prismjs/components/prism-ruby.js");
require("prismjs/components/prism-rust.js");
require("prismjs/components/prism-sass.js");
require("prismjs/components/prism-scala.js");
require("prismjs/components/prism-sql.js");
require("prismjs/components/prism-swift.js");
require("prismjs/components/prism-tsx.js");
require("prismjs/components/prism-typescript.js");
require("prismjs/components/prism-yaml.js");

export function getFileLang(filename: string): string {
  const segments: string[] = filename.split(".");
  const ext: string = segments[segments.length - 1];

  const suggested = LANG_MAP[ext];
  if (suggested) {
    return suggested;
  }

  return "markup";
}
