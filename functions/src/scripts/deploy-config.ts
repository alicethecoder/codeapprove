const fbt = require("firebase-tools");

function flatten(obj: any, prefix: string[] = [], current: any = {}) {
  // Remember kids, null is also an object!
  if (typeof obj === "object" && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      flatten(val, prefix.concat(key), current);
    });
  } else {
    current[prefix.join(".")] = obj;
  }

  return current;
}

async function main() {
  // TODO(stop): Finish this script, allow switching projects
  const project = "codeapprove-dev";
  const configSource = require("../../.runtimeconfig.json");
  const flatConfig = flatten(configSource);

  const args: string[] = [];
  Object.keys(flatConfig).forEach((key) => {
    console.log(`Setting ${key}`);
    const val = flatConfig[key];
    args.push(`${key}=${val}`);
  });

  await fbt.functions.config.set(args, {
    project,
  });
}

main();
