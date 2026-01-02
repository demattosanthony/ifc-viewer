import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createLocalComputer } from "../src";
import type { ComputeOps } from "@ifc-viewer/core";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";

describe("LocalComputer", () => {
  let computer: ComputeOps;
  const testWorkspace = "/tmp/bim-test-workspace";

  beforeEach(async () => {
    computer = await createLocalComputer({
      workingDirectory: testWorkspace,
      cleanup: true,
    });
  });

  afterEach(async () => {
    await computer.dispose();
  });

  describe("initialization", () => {
    test("creates working directory on init", () => {
      expect(existsSync(testWorkspace)).toBe(true);
    });

    test("does not create nested directories from absolute path", async () => {
      // The bug was that /tmp/test-workspace would create /tmp/test-workspace/tmp/test-workspace
      const entries = await readdir(testWorkspace);
      expect(entries).not.toContain("tmp");
      expect(entries).not.toContain("Users");
    });

    test("exposes working directory", () => {
      expect(computer.workingDirectory).toBe(testWorkspace);
    });
  });

  describe("files.write", () => {
    test("writes file to workspace root", async () => {
      await computer.files.write("/test.txt", "hello world");

      const content = await computer.files.read("/test.txt");
      expect(content.type).toBe("text");
      expect(content.content).toBe("hello world");
    });

    test("writes file without leading slash", async () => {
      await computer.files.write("test.txt", "hello world");

      const content = await computer.files.read("test.txt");
      expect(content.content).toBe("hello world");
    });

    test("creates parent directories automatically", async () => {
      await computer.files.write("/nested/deep/file.txt", "nested content");

      const content = await computer.files.read("/nested/deep/file.txt");
      expect(content.content).toBe("nested content");
    });

    test("writes binary content", async () => {
      const binary = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      await computer.files.write("/binary.bin", binary);

      const content = await computer.files.read("/binary.bin", {
        encoding: "binary",
      });
      expect(content.type).toBe("binary");
      expect(content.content).toEqual(binary);
    });
  });

  describe("files.read", () => {
    test("reads text file", async () => {
      await computer.files.write("/readme.md", "# Hello");

      const content = await computer.files.read("/readme.md");
      expect(content.type).toBe("text");
      expect(content.content).toBe("# Hello");
    });

    test("reads binary file", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await computer.files.write("/data.bin", data);

      const content = await computer.files.read("/data.bin", {
        encoding: "binary",
      });
      expect(content.type).toBe("binary");
      expect(content.content).toEqual(data);
    });
  });

  describe("files.list", () => {
    test("lists files in directory", async () => {
      await computer.files.write("/file1.txt", "one");
      await computer.files.write("/file2.txt", "two");

      const entries = await computer.files.list("/");
      const names = entries.map((e: { name: string }) => e.name);

      expect(names).toContain("file1.txt");
      expect(names).toContain("file2.txt");
    });

    test("lists nested directories", async () => {
      await computer.files.write("/src/index.ts", "export {}");

      const entries = await computer.files.list("/");
      const srcDir = entries.find((e: { name: string }) => e.name === "src");

      expect(srcDir).toBeDefined();
      expect(srcDir?.type).toBe("directory");
    });
  });

  describe("files.mkdir", () => {
    test("creates directory", async () => {
      await computer.files.mkdir("/new-dir");

      const entries = await computer.files.list("/");
      const dir = entries.find((e: { name: string }) => e.name === "new-dir");

      expect(dir).toBeDefined();
      expect(dir?.type).toBe("directory");
    });

    test("creates nested directories with recursive option", async () => {
      await computer.files.mkdir("/a/b/c", { recursive: true });

      const entries = await computer.files.list("/a/b");
      const dir = entries.find((e: { name: string }) => e.name === "c");

      expect(dir).toBeDefined();
      expect(dir?.type).toBe("directory");
    });
  });

  describe("files.delete", () => {
    test("deletes a file", async () => {
      await computer.files.write("/to-delete.txt", "goodbye");
      await computer.files.delete("/to-delete.txt");

      expect(computer.files.read("/to-delete.txt")).rejects.toThrow();
    });

    test("deletes an empty directory", async () => {
      await computer.files.mkdir("/empty-dir");
      await computer.files.delete("/empty-dir");

      const entries = await computer.files.list("/");
      expect(entries.find((e: { name: string }) => e.name === "empty-dir")).toBeUndefined();
    });

    test("fails on non-empty directory without recursive", async () => {
      await computer.files.write("/dir/file.txt", "content");

      expect(computer.files.delete("/dir")).rejects.toThrow();
    });

    test("deletes non-empty directory with recursive option", async () => {
      await computer.files.write("/dir/nested/file.txt", "content");
      await computer.files.delete("/dir", { recursive: true });

      const entries = await computer.files.list("/");
      expect(entries.find((e: { name: string }) => e.name === "dir")).toBeUndefined();
    });
  });

  describe("files.stat", () => {
    test("returns file stats", async () => {
      await computer.files.write("/stats-test.txt", "hello");

      const stats = await computer.files.stat("/stats-test.txt");

      expect(stats.type).toBe("file");
      expect(stats.size).toBe(5);
      expect(stats.createdAt).toBeGreaterThan(0);
      expect(stats.modifiedAt).toBeGreaterThan(0);
      expect(stats.accessedAt).toBeGreaterThan(0);
    });

    test("returns directory stats", async () => {
      await computer.files.mkdir("/stats-dir");

      const stats = await computer.files.stat("/stats-dir");

      expect(stats.type).toBe("directory");
    });

    test("throws for non-existent path", async () => {
      expect(computer.files.stat("/does-not-exist")).rejects.toThrow();
    });
  });

  describe("files.copy", () => {
    test("copies a file", async () => {
      await computer.files.write("/original.txt", "original content");
      await computer.files.copy("/original.txt", "/copied.txt");

      const original = await computer.files.read("/original.txt");
      const copied = await computer.files.read("/copied.txt");

      expect(original.content).toBe("original content");
      expect(copied.content).toBe("original content");
    });

    test("copies to nested destination creating parent dirs", async () => {
      await computer.files.write("/source.txt", "data");
      await computer.files.copy("/source.txt", "/deep/nested/dest.txt");

      const content = await computer.files.read("/deep/nested/dest.txt");
      expect(content.content).toBe("data");
    });

    test("copies a directory recursively", async () => {
      await computer.files.write("/src-dir/a.txt", "file a");
      await computer.files.write("/src-dir/sub/b.txt", "file b");

      await computer.files.copy("/src-dir", "/dest-dir");

      const a = await computer.files.read("/dest-dir/a.txt");
      const b = await computer.files.read("/dest-dir/sub/b.txt");

      expect(a.content).toBe("file a");
      expect(b.content).toBe("file b");
    });
  });

  describe("files.move", () => {
    test("moves a file", async () => {
      await computer.files.write("/old-name.txt", "content");
      await computer.files.move("/old-name.txt", "/new-name.txt");

      const content = await computer.files.read("/new-name.txt");
      expect(content.content).toBe("content");

      expect(computer.files.read("/old-name.txt")).rejects.toThrow();
    });

    test("moves to nested destination creating parent dirs", async () => {
      await computer.files.write("/moveme.txt", "moving");
      await computer.files.move("/moveme.txt", "/new/path/moved.txt");

      const content = await computer.files.read("/new/path/moved.txt");
      expect(content.content).toBe("moving");
    });

    test("moves a directory", async () => {
      await computer.files.write("/old-dir/file.txt", "inside");
      await computer.files.move("/old-dir", "/new-dir");

      const content = await computer.files.read("/new-dir/file.txt");
      expect(content.content).toBe("inside");

      expect(computer.files.stat("/old-dir")).rejects.toThrow();
    });
  });

  describe("path security", () => {
    test("prevents path traversal with ..", async () => {
      expect(
        computer.files.write("/../../../etc/passwd", "hacked")
      ).rejects.toThrow("Path escapes sandbox");
    });

    test("prevents path traversal from nested directory", async () => {
      expect(
        computer.files.read("/foo/../../bar/../../../etc/passwd")
      ).rejects.toThrow("Path escapes sandbox");
    });

    test("treats absolute paths as relative to workspace", async () => {
      // /etc/passwd becomes {workspace}/etc/passwd, not the system file
      await computer.files.mkdir("/etc", { recursive: true });
      await computer.files.write("/etc/passwd", "sandboxed");

      const content = await computer.files.read("/etc/passwd");
      expect(content.content).toBe("sandboxed");
    });
  });

  describe("dispose", () => {
    test("cleans up workspace when cleanup is true", async () => {
      await computer.files.write("/cleanup-test.txt", "test");
      await computer.dispose();

      expect(existsSync(testWorkspace)).toBe(false);
    });
  });
});

describe("LocalComputer terminal management", () => {
  let computer: ComputeOps;
  const testWorkspace = "/tmp/bim-terminal-mgmt-test";

  beforeEach(async () => {
    computer = await createLocalComputer({
      workingDirectory: testWorkspace,
      cleanup: true,
    });
  });

  afterEach(async () => {
    await computer.dispose();
  });

  describe("createTerminal", () => {
    test("creates a terminal and tracks it", async () => {
      const terminal = await computer.createTerminal();

      expect(terminal.id).toMatch(/^terminal-\d+-[a-z0-9]+$/);
      expect(computer.getTerminal(terminal.id)).toBe(terminal);
      expect(computer.getAllTerminals()).toContain(terminal);

      await terminal.kill();
    });

    test("creates multiple terminals", async () => {
      const term1 = await computer.createTerminal();
      const term2 = await computer.createTerminal();

      expect(term1.id).not.toBe(term2.id);
      expect(computer.getAllTerminals().length).toBe(2);

      await term1.kill();
      await term2.kill();
    });
  });

  describe("disposeTerminal", () => {
    test("disposes and removes terminal", async () => {
      const terminal = await computer.createTerminal();
      const id = terminal.id;

      await computer.disposeTerminal(id);

      expect(computer.getTerminal(id)).toBeUndefined();
      expect(computer.getAllTerminals().length).toBe(0);
    });
  });

  describe("agent terminal", () => {
    test("creates agent terminal on first call", async () => {
      expect(computer.hasAgentTerminal()).toBe(false);

      const terminal = await computer.getOrCreateAgentTerminal();

      expect(computer.hasAgentTerminal()).toBe(true);
      expect(terminal.id).toBeDefined();

      await terminal.kill();
    });

    test("returns same agent terminal on subsequent calls", async () => {
      const term1 = await computer.getOrCreateAgentTerminal();
      const term2 = await computer.getOrCreateAgentTerminal();

      expect(term1).toBe(term2);

      await term1.kill();
    });

    test("clears agent terminal reference when disposed", async () => {
      const terminal = await computer.getOrCreateAgentTerminal();
      const id = terminal.id;

      await computer.disposeTerminal(id);

      expect(computer.hasAgentTerminal()).toBe(false);
    });
  });
});

describe("LocalShell", () => {
  let computer: ComputeOps;
  const testWorkspace = "/tmp/bim-shell-test-workspace";

  beforeEach(async () => {
    computer = await createLocalComputer({
      workingDirectory: testWorkspace,
      cleanup: true,
    });
  });

  afterEach(async () => {
    await computer.dispose();
  });

  describe("startTerminal", () => {
    test("creates a terminal session with unique id", async () => {
      const session = await computer.shell.startTerminal();

      expect(session.id).toMatch(/^terminal-\d+-[a-z0-9]+$/);

      await session.kill();
    });

    test("creates multiple sessions with different ids", async () => {
      const session1 = await computer.shell.startTerminal();
      const session2 = await computer.shell.startTerminal();

      expect(session1.id).not.toBe(session2.id);

      await session1.kill();
      await session2.kill();
    });
  });

  describe("write and onData", () => {
    test("executes commands and receives output", async () => {
      const session = await computer.shell.startTerminal();
      const output: string[] = [];

      session.onData((data: string) => {
        output.push(data);
      });

      await session.write("echo 'hello world'\n");

      // Wait for output
      await new Promise((resolve) => setTimeout(resolve, 200));

      const fullOutput = output.join("");
      expect(fullOutput).toContain("hello world");

      await session.kill();
    });

    test("executes multiple commands", async () => {
      const session = await computer.shell.startTerminal();
      const output: string[] = [];

      session.onData((data: string) => {
        output.push(data);
      });

      await session.write("echo 'first'\n");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await session.write("echo 'second'\n");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const fullOutput = output.join("");
      expect(fullOutput).toContain("first");
      expect(fullOutput).toContain("second");

      await session.kill();
    });

    test("captures stderr output", async () => {
      const session = await computer.shell.startTerminal();
      const output: string[] = [];

      session.onData((data: string) => {
        output.push(data);
      });

      await session.write("echo 'error message' >&2\n");

      await new Promise((resolve) => setTimeout(resolve, 200));

      const fullOutput = output.join("");
      expect(fullOutput).toContain("error message");

      await session.kill();
    });
  });

  describe("onData callback management", () => {
    test("supports multiple data callbacks", async () => {
      const session = await computer.shell.startTerminal();
      const output1: string[] = [];
      const output2: string[] = [];

      session.onData((data: string) => output1.push(data));
      session.onData((data: string) => output2.push(data));

      await session.write("echo 'multi-callback'\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(output1.join("")).toContain("multi-callback");
      expect(output2.join("")).toContain("multi-callback");

      await session.kill();
    });

    test("unsubscribe function removes callback", async () => {
      const session = await computer.shell.startTerminal();
      const output1: string[] = [];
      const output2: string[] = [];

      const unsub1 = session.onData((data: string) => output1.push(data));
      session.onData((data: string) => output2.push(data));

      // Unsubscribe first callback
      unsub1();

      await session.write("echo 'after-unsub'\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // First callback should NOT receive data (it was unsubscribed)
      // Second callback should receive data
      expect(output1.join("")).not.toContain("after-unsub");
      expect(output2.join("")).toContain("after-unsub");

      await session.kill();
    });
  });

  describe("onExit", () => {
    test("calls exit callback when shell exits", async () => {
      const session = await computer.shell.startTerminal();

      const exitPromise = new Promise<number>((resolve) => {
        session.onExit((code: number) => resolve(code));
      });

      await session.write("exit 0\n");

      const exitCode = await exitPromise;
      expect(exitCode).toBe(0);
    });

    test("returns non-zero exit code on error", async () => {
      const session = await computer.shell.startTerminal();

      const exitPromise = new Promise<number>((resolve) => {
        session.onExit((code: number) => resolve(code));
      });

      await session.write("exit 42\n");

      const exitCode = await exitPromise;
      expect(exitCode).toBe(42);
    });

    test("supports multiple exit callbacks", async () => {
      const session = await computer.shell.startTerminal();
      const exitCodes: number[] = [];

      session.onExit((code: number) => exitCodes.push(code));
      session.onExit((code: number) => exitCodes.push(code * 2));

      await session.write("exit 5\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(exitCodes).toContain(5);
      expect(exitCodes).toContain(10);
    });

    test("unsubscribe function removes exit callback", async () => {
      const session = await computer.shell.startTerminal();
      const exitCodes: number[] = [];

      const unsub = session.onExit((code: number) => exitCodes.push(code));
      session.onExit((code: number) => exitCodes.push(code * 10));

      unsub();

      await session.write("exit 3\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      // First callback unsubscribed, second should still fire
      expect(exitCodes).not.toContain(3);
      expect(exitCodes).toContain(30);
    });
  });

  describe("kill", () => {
    test("terminates the shell process", async () => {
      const session = await computer.shell.startTerminal();
      let exited = false;

      session.onExit(() => {
        exited = true;
      });

      await session.kill();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(exited).toBe(true);
    });

    test("terminates with specific signal", async () => {
      const session = await computer.shell.startTerminal();
      let exitCode: number | null = null;

      session.onExit((code: number) => {
        exitCode = code;
      });

      await session.kill(9); // SIGKILL
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(exitCode).not.toBeNull();
    });
  });

  describe("terminal options", () => {
    test("uses custom working directory", async () => {
      await computer.files.mkdir("/custom-cwd");
      await computer.files.write("/custom-cwd/marker.txt", "found");

      const session = await computer.shell.startTerminal({
        cwd: `${testWorkspace}/custom-cwd`,
      });
      const output: string[] = [];

      session.onData((data: string) => output.push(data));

      await session.write("cat marker.txt\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(output.join("")).toContain("found");

      await session.kill();
    });

    test("uses custom environment variables", async () => {
      const session = await computer.shell.startTerminal({
        env: { CUSTOM_VAR: "custom_value_123" },
      });
      const output: string[] = [];

      session.onData((data: string) => output.push(data));

      await session.write("echo $CUSTOM_VAR\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(output.join("")).toContain("custom_value_123");

      await session.kill();
    });
  });

  describe("environment inheritance", () => {
    test("inherits default environment from computer config", async () => {
      const computerWithEnv = await createLocalComputer({
        workingDirectory: "/tmp/bim-env-test",
        environment: { DEFAULT_VAR: "default_value_456" },
        cleanup: true,
      });

      const session = await computerWithEnv.shell.startTerminal();
      const output: string[] = [];

      session.onData((data: string) => output.push(data));

      await session.write("echo $DEFAULT_VAR\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(output.join("")).toContain("default_value_456");

      await session.kill();
      await computerWithEnv.dispose();
    });

    test("terminal env overrides default env", async () => {
      const computerWithEnv = await createLocalComputer({
        workingDirectory: "/tmp/bim-env-override-test",
        environment: { OVERRIDE_VAR: "original" },
        cleanup: true,
      });

      const session = await computerWithEnv.shell.startTerminal({
        env: { OVERRIDE_VAR: "overridden" },
      });
      const output: string[] = [];

      session.onData((data: string) => output.push(data));

      await session.write("echo $OVERRIDE_VAR\n");
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(output.join("")).toContain("overridden");

      await session.kill();
      await computerWithEnv.dispose();
    });
  });
});
