#!/usr/bin/env node
// Whole-project native feedback. Incremental caches regressed after real edits in benchmarks.
import { spawn } from "node:child_process";
import getTsgoExe from "../node_modules/@typescript/native-preview/lib/getExePath.js";

const child = spawn(getTsgoExe(), ["--noEmit", "--incremental", "false"], { stdio: "inherit" });
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    child.kill(signal);
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 3000).unref();
  });
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.exitCode = interrupted || signal ? 130 : (code ?? 1);
});
