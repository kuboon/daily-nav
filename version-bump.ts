/// <reference lib="deno.ns" />

import { equals, parse } from "@std/semver";

const manifest = JSON.parse(Deno.readTextFileSync("manifest.json"));
const { minAppVersion, version } = manifest;

const versions = JSON.parse(Deno.readTextFileSync("versions.json"));
const latestMinAppVersion = Object.values<string>(versions).slice(-1)[0];
if (equals(parse(minAppVersion), parse(latestMinAppVersion))) Deno.exit(0);

// update versions.json with target version and minAppVersion from manifest.json
versions[version] = minAppVersion;
Deno.writeTextFileSync(
  "versions.json",
  JSON.stringify(versions, null, "\t") + "\n",
);
