import { spawn } from "node:child_process"

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

function runScript(script) {
  if (process.platform === "win32") {
    return spawn(`${npmCommand} run ${script}`, {
      stdio: "inherit",
      shell: true,
    })
  }

  return spawn(npmCommand, ["run", script], { stdio: "inherit" })
}

const processes = [
  runScript("dev:web"),
  runScript("dev:api"),
]

let shuttingDown = false

function stop(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM")
  }

  process.exit(exitCode)
}

process.on("SIGINT", () => stop())
process.on("SIGTERM", () => stop())

for (const child of processes) {
  child.on("exit", (code) => {
    if (!shuttingDown) stop(code ?? 1)
  })
}
