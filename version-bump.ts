/// <reference lib="deno.ns" />

const manifest = JSON.parse(Deno.readTextFileSync("manifest.json"));
const { minAppVersion, version } = manifest;

const versions = JSON.parse(Deno.readTextFileSync("versions.json"));
if (version in versions) {
  console.info(`Version ${version} already exists in versions.json`);
  Deno.exit();
}
// update versions.json with target version and minAppVersion from manifest.json
versions[version] = minAppVersion;
Deno.writeTextFileSync("versions.json", JSON.stringify(versions, null, "\t"));

console.info(`Run 'git tag ${version}' to create a new tag`);
