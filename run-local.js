const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const apps = [
  { name: "api-server", path: "artifacts/api-server" },
  { name: "cqg-plant-inspection", path: "artifacts/cqg-plant-inspection" },
  { name: "frontend", path: "artifacts/frontend" },
  { name: "other-app", path: "artifacts/other-app" }
];

// adjust if needed (detects npm scripts automatically)
function run(cmd, args, cwd, name) {
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: "pipe"
  });

  proc.stdout.on("data", d => {
    process.stdout.write(`[${name}] ${d}`);
  });

  proc.stderr.on("data", d => {
    process.stderr.write(`[${name} ERROR] ${d}`);
  });

  return proc;
}

function install(app) {
  if (!fs.existsSync(app.path)) return;

  console.log(`\nInstalling ${app.name}...`);
  run("npm", ["install"], app.path, app.name);
}

function start(app) {
  const pkg = path.join(app.path, "package.json");
  if (!fs.existsSync(pkg)) {
    console.log(`Skipping ${app.name} (no package.json)`);
    return;
  }

  console.log(`Starting ${app.name}...`);

  // prefer dev, fallback to start
  const script = "dev";

  return run("npm", ["run", script], app.path, app.name);
}

// STEP 1: install all
apps.forEach(install);

// small delay to let installs kick in
setTimeout(() => {
  console.log("\n🚀 Starting all apps...\n");

  apps.forEach(start);
}, 8000);