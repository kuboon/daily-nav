/// <reference lib="deno.ns" />

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(Deno.readTextFileSync("manifest.json"));
const { minAppVersion, version } = manifest;

// update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(Deno.readTextFileSync("versions.json"));
versions[version] = minAppVersion;
Deno.writeTextFileSync("versions.json", JSON.stringify(versions, null, "\t"));
