import path from "path";
import fs from "fs";
import os from "os";
import { useRuntimeHandlers } from "../handlers.js";
import { useRuntimeWorkers } from "../workers.js";
import { Context } from "../../context/context.js";
import { VisibleError } from "../../error.js";
import { ChildProcessWithoutNullStreams, exec, spawn } from "child_process";
import { useRuntimeServerConfig } from "../server.js";
import { isChild } from "../../util/fs.js";
import { execAsync } from "../../util/process.js";
import { useApp } from "../../constructs/context.js";

export const useBunHandler = Context.memo(async () => {
  const handlers = useRuntimeHandlers();
  const processes = new Map<string, ChildProcessWithoutNullStreams>();
  const sources = new Map<string, string>();

  handlers.register({
    shouldBuild: (input) => {
      const parent = sources.get(input.functionID);
      if (!parent) return false;
      return isChild(parent, input.file);
    },
    canHandle: (input) => input.startsWith("bun"),
    startWorker: async (input) => {},
    stopWorker: async (workerID) => {
      const proc = processes.get(workerID);
      if (proc) {
        proc.kill();
        processes.delete(workerID);
      }
    },
    build: async (input) => {
      const parsed = path.parse(input.props.handler!);
      const file = [
        ".ts",
        ".tsx",
        ".mts",
        ".cts",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
      ]
        .map((ext) => path.join(parsed.dir, parsed.name + ext))
        .find((file) => {
          return fs.existsSync(file);
        })!;
      if (!file)
        return {
          type: "error",
          errors: [`Could not find file for handler "${input.props.handler}"`],
        };
      if (input.mode === "start") {
      }

      if (input.mode === "deploy") {
        await execAsync(
          [
            "bun",
            "build",
            file,
            "--outfile",
            path.join(input.out, "output.mjs"),
          ].join(" "),
          {
            env: {
              ...process.env,
            },
          }
        );
      }

      return {
        type: "success",
        layers: ["arn:aws:lambda:us-east-1:226609089145:layer:bun-1_0_0:2"],
        handler: "output" + parsed.ext,
      };
    },
  });
});
