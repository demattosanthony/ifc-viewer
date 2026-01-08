/**
 * DockerComputer Tests
 *
 * Tests for the Docker-based computer implementation.
 * Requires Docker to be running and the bim-ide:latest image to be built.
 *
 * Run: bun run docker:build:bim-ide
 * Then: bun test packages/infrastructure/tests/compute/docker.test.ts
 *
 * NOTE: Tests use a single shared container for speed. Container lifecycle
 * tests are separate and create their own containers.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { DockerComputer, createDockerComputer } from "../../src/compute/docker"
import type { Computer } from "@ifc-viewer/core"

const TEST_IMAGE = "bim-ide:latest"
const TEST_TIMEOUT = 30000

// Shared state for all tests
let dockerAvailable = false
let imageAvailable = false
let sharedComputer: Computer | null = null

// Helper to check if Docker is available
async function isDockerAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["docker", "info"], { stdout: "ignore", stderr: "ignore" })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

// Helper to check if test image exists
async function isImageAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["docker", "image", "inspect", TEST_IMAGE], {
      stdout: "ignore",
      stderr: "ignore",
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

// Skip helper
function skipIfUnavailable(): boolean {
  return !dockerAvailable || !imageAvailable
}

describe("DockerComputer", () => {
  // Setup shared container once for all tests
  beforeAll(async () => {
    dockerAvailable = await isDockerAvailable()
    if (dockerAvailable) {
      imageAvailable = await isImageAvailable()
    }

    if (!dockerAvailable) {
      console.warn("Docker is not available - skipping Docker tests")
      return
    }
    if (!imageAvailable) {
      console.warn(`Image ${TEST_IMAGE} not found - run 'bun run docker:build:bim-ide' first`)
      return
    }

    // Create shared container (ephemeral - no host mounts needed)
    sharedComputer = await createDockerComputer({
      image: TEST_IMAGE,
    })
  }, TEST_TIMEOUT)

  // Cleanup shared container after all tests
  afterAll(async () => {
    if (sharedComputer) {
      await sharedComputer.dispose()
      sharedComputer = null
    }
  })

  // ============================================================================
  // Container Lifecycle Tests (these create their own containers)
  // ============================================================================

  describe("container lifecycle", () => {
    test("creates container with resource limits, verifies properties, and removes on dispose", async () => {
      if (skipIfUnavailable()) return

      // Test creation with resource limits (ephemeral - no host mounts)
      const computer = await createDockerComputer({
        image: TEST_IMAGE,
        memory: "256m",
        cpus: 0.5,
      })

      // Verify properties
      expect(computer.id).toMatch(/^docker-computer-/)
      expect(computer.workingDirectory).toBe("/workspace") // Container internal path

      // Get container ID before dispose
      const containerId = (computer as DockerComputer)["containerId"]
      expect(containerId).toBeTruthy()

      // Test dispose
      await computer.dispose()

      // Verify container is removed
      const proc = Bun.spawn(["docker", "container", "inspect", containerId!], {
        stdout: "ignore",
        stderr: "ignore",
      })
      expect(await proc.exited).not.toBe(0)
    }, TEST_TIMEOUT)
  })

  // ============================================================================
  // FileSystem Tests (use shared container)
  // ============================================================================

  describe("DockerFileSystem", () => {
    test("writes and reads text file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.write("fs_test.txt", "hello from docker")
      const result = await sharedComputer.files.read("fs_test.txt")

      expect(result.type).toBe("text")
      expect(result.content).toBe("hello from docker")
    })

    test("writes and reads binary file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      await sharedComputer.files.write("fs_binary.bin", data)
      const result = await sharedComputer.files.read("fs_binary.bin", { encoding: "binary" })

      expect(result.type).toBe("binary")
      expect(result.content).toEqual(data)
    })

    test("creates directory", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_subdir")
      const stats = await sharedComputer.files.stat("fs_subdir")

      expect(stats.type).toBe("directory")
    })

    test("creates nested directories with recursive option", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_nested/a/b/c", { recursive: true })
      const stats = await sharedComputer.files.stat("fs_nested/a/b/c")

      expect(stats.type).toBe("directory")
    })

    test("lists directory contents", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_listdir", { recursive: true })
      await sharedComputer.files.write("fs_listdir/file1.txt", "content1")
      await sharedComputer.files.write("fs_listdir/file2.txt", "content2")
      await sharedComputer.files.mkdir("fs_listdir/nested", { recursive: true })

      const entries = await sharedComputer.files.list("fs_listdir")

      expect(entries.length).toBe(3)
      const names = entries.map((e) => e.name).sort()
      expect(names).toContain("file1.txt")
      expect(names).toContain("file2.txt")
      expect(names).toContain("nested")
    })

    test("returns file stats", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.write("fs_statfile.txt", "hello")
      const stats = await sharedComputer.files.stat("fs_statfile.txt")

      expect(stats.type).toBe("file")
      expect(stats.size).toBe(5)
      expect(typeof stats.modifiedAt).toBe("number")
    })

    test("deletes file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.write("fs_deleteme.txt", "content")
      await sharedComputer.files.delete("fs_deleteme.txt")

      await expect(sharedComputer.files.stat("fs_deleteme.txt")).rejects.toThrow()
    })

    test("deletes directory recursively", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_deletedir/nested", { recursive: true })
      await sharedComputer.files.write("fs_deletedir/nested/file.txt", "content")
      await sharedComputer.files.delete("fs_deletedir", { recursive: true })

      await expect(sharedComputer.files.stat("fs_deletedir")).rejects.toThrow()
    })

    test("copies file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_copytest", { recursive: true })
      await sharedComputer.files.write("fs_copytest/source.txt", "copy me")
      await sharedComputer.files.copy("fs_copytest/source.txt", "fs_copytest/dest.txt")

      const result = await sharedComputer.files.read("fs_copytest/dest.txt")
      expect(result.content).toBe("copy me")
    })

    test("moves file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.mkdir("fs_movetest", { recursive: true })
      await sharedComputer.files.write("fs_movetest/source.txt", "move me")
      await sharedComputer.files.move("fs_movetest/source.txt", "fs_movetest/dest.txt")

      await expect(sharedComputer.files.stat("fs_movetest/source.txt")).rejects.toThrow()
      const result = await sharedComputer.files.read("fs_movetest/dest.txt")
      expect(result.content).toBe("move me")
    })

    test("rejects path traversal attempts", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await expect(sharedComputer.files.read("../etc/passwd")).rejects.toThrow("escapes sandbox")
      await expect(sharedComputer.files.write("../../evil.txt", "bad")).rejects.toThrow("escapes sandbox")
    })

    test("writes and reads large file (>100KB)", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      // Create a ~150KB file (larger than typical command line limits)
      const largeContent = "x".repeat(150 * 1024)
      await sharedComputer.files.write("fs_large_file.txt", largeContent)

      const result = await sharedComputer.files.read("fs_large_file.txt")
      expect(result.type).toBe("text")
      expect((result.content as string).length).toBe(largeContent.length)
      expect(result.content).toBe(largeContent)
    })

    test("writes and reads large binary file", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      // Create a ~200KB binary file
      const largeBinary = new Uint8Array(200 * 1024)
      for (let i = 0; i < largeBinary.length; i++) {
        largeBinary[i] = i % 256
      }

      await sharedComputer.files.write("fs_large_binary.bin", largeBinary)
      const result = await sharedComputer.files.read("fs_large_binary.bin", { encoding: "binary" })

      expect(result.type).toBe("binary")
      expect((result.content as Uint8Array).length).toBe(largeBinary.length)
      expect(result.content).toEqual(largeBinary)
    })
  })

  // ============================================================================
  // Shell Tests (use shared container)
  // ============================================================================

  describe("DockerShell", () => {
    test("creates terminal session", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()

      expect(terminal.id).toMatch(/^terminal-/)
      expect(typeof terminal.write).toBe("function")
      expect(typeof terminal.resize).toBe("function")
      expect(typeof terminal.kill).toBe("function")
      expect(typeof terminal.onData).toBe("function")
      expect(typeof terminal.onExit).toBe("function")

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("executes command and receives output", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      const unsubscribe = terminal.onData((data) => {
        output.push(data)
      })

      await terminal.write("echo 'hello docker'\n")
      await new Promise((resolve) => setTimeout(resolve, 300))

      unsubscribe()
      await sharedComputer.disposeTerminal(terminal.id)

      expect(output.join("")).toContain("hello docker")
    })

    test("can run Python with ifcopenshell", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await terminal.write("python3 -c \"import ifcopenshell; print('IFC VERSION:', ifcopenshell.version)\"\n")
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await sharedComputer.disposeTerminal(terminal.id)

      expect(output.join("")).toContain("IFC VERSION:")
    })

    test("manages agent terminal singleton", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      expect(sharedComputer.hasAgentTerminal()).toBe(false)

      const terminal1 = await sharedComputer.getOrCreateAgentTerminal()
      expect(sharedComputer.hasAgentTerminal()).toBe(true)

      const terminal2 = await sharedComputer.getOrCreateAgentTerminal()
      expect(terminal1.id).toBe(terminal2.id)

      await sharedComputer.disposeTerminal(terminal1.id)
      expect(sharedComputer.hasAgentTerminal()).toBe(false)
    })

    test("tracks all terminals", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const t1 = await sharedComputer.createTerminal()
      const t2 = await sharedComputer.createTerminal()

      const all = sharedComputer.getAllTerminals()
      expect(all.length).toBe(2)

      expect(sharedComputer.getTerminal(t1.id)).toBe(t1)
      expect(sharedComputer.getTerminal(t2.id)).toBe(t2)

      await sharedComputer.disposeTerminal(t1.id)
      await sharedComputer.disposeTerminal(t2.id)

      expect(sharedComputer.getAllTerminals().length).toBe(0)
    })

    test("resizes terminal (no-op in command mode)", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()

      // Should not throw
      terminal.resize(120, 40)

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("buffers keystrokes until newline", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      // Type characters one at a time (simulating real terminal input)
      await terminal.write("e")
      await terminal.write("c")
      await terminal.write("h")
      await terminal.write("o")
      await terminal.write(" ")
      await terminal.write("h")
      await terminal.write("i")

      // Wait a bit - should NOT have executed anything yet
      await new Promise((resolve) => setTimeout(resolve, 200))

      const outputBeforeEnter = output.join("")
      // Should only see echoed characters, not "command not found" errors
      expect(outputBeforeEnter).not.toContain("command not found")

      // Now press Enter
      await terminal.write("\n")
      await new Promise((resolve) => setTimeout(resolve, 500))

      const finalOutput = output.join("")
      // Should see "hi" in output (from echo command)
      expect(finalOutput).toContain("hi")

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("handles backspace correctly", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Type "echox" then backspace and " hi"
      // This should result in "echo hi" being executed
      await terminal.write("echox")
      await terminal.write("\x7f") // Backspace - removes "x"
      await terminal.write(" hi")
      await terminal.write("\n")

      await new Promise((resolve) => setTimeout(resolve, 500))

      const finalOutput = output.join("")
      
      // The key test is that the COMMAND executed was "echo hi", not "echox hi"
      // We verify this by checking the command output contains "hi" on its own line
      expect(finalOutput).toContain("hi\r\n")
      
      // Verify backspace was processed - the terminal will show the backspace
      // character (\b or \x08) followed by some erase sequence
      expect(finalOutput).toContain("\b")
      
      // Should NOT contain an error like "command not found" which would happen
      // if "echox" was executed instead of "echo"
      expect(finalOutput).not.toContain("not found")
      expect(finalOutput).not.toContain("No such file")

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("shows initial prompt immediately after onData is registered", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      // Register onData callback - should receive initial prompt
      terminal.onData((data) => {
        output.push(data)
      })

      // Wait a short time for any async emission
      await new Promise((resolve) => setTimeout(resolve, 100))

      const initialOutput = output.join("")
      
      // Should have received the initial prompt with /workspace path
      expect(initialOutput).toContain("/workspace")
      expect(initialOutput).toContain("$")

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("prompt output should not contain literal tab characters or escape artifacts", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      // Run a simple command to get prompt output
      await terminal.write("echo test\n")
      await new Promise((resolve) => setTimeout(resolve, 500))

      const finalOutput = output.join("")

      // Should NOT contain literal \t tab characters in prompt
      // (tabs should only appear if user explicitly typed them)
      // The prompt "workspace $ " should be clean
      expect(finalOutput).toContain("test")
      
      // Check that prompt doesn't have weird escape artifacts
      // The prompt should just be cyan "/workspace" followed by " $ "
      // Should not contain \[ or \] which are bash PS1 escape markers
      expect(finalOutput).not.toContain("\\[")
      expect(finalOutput).not.toContain("\\]")
      
      // Should not contain literal tab characters in the prompt line
      // Split by newlines and check prompt lines
      const lines = finalOutput.split(/\r?\n/)
      const promptLines = lines.filter(line => line.includes("/workspace") && line.includes("$"))
      for (const promptLine of promptLines) {
        expect(promptLine).not.toContain("\t")
      }

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("command output uses CRLF line endings for proper terminal display", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Run a command that produces multiple lines of output
      await terminal.write("echo -e 'line1\\nline2\\nline3'\n")
      await new Promise((resolve) => setTimeout(resolve, 500))

      const finalOutput = output.join("")

      // The output should contain CRLF (\r\n) for each line break in command output
      // This ensures the terminal cursor returns to column 0 after each line
      // Without \r, lines would appear staggered/concatenated horizontally
      expect(finalOutput).toContain("line1\r\n")
      expect(finalOutput).toContain("line2\r\n")
      expect(finalOutput).toContain("line3\r\n")

      // Should NOT have bare \n without \r (except possibly at very end)
      // Check that we don't have patterns like "line1\nline2" (LF without CR)
      const outputAfterCommand = finalOutput.split("line1")[1] || ""
      expect(outputAfterCommand).not.toMatch(/[^\r]\nline2/)

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("tab completion completes unique file names", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      // Create a file with a unique prefix for testing
      await sharedComputer.files.write("tabtest_unique_file.txt", "test content")

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Type "cat tabtest_" and press Tab
      await terminal.write("cat tabtest_")
      await terminal.write("\t") // Tab

      await new Promise((resolve) => setTimeout(resolve, 500))

      const finalOutput = output.join("")

      // Should have completed to "tabtest_unique_file.txt"
      expect(finalOutput).toContain("tabtest_unique_file.txt")

      await sharedComputer.disposeTerminal(terminal.id)
    })

    test("tab completion completes common prefix when ambiguous", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      // Create multiple files with same prefix
      await sharedComputer.files.write("tabmulti_one.txt", "one")
      await sharedComputer.files.write("tabmulti_two.txt", "two")

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Type "cat tabmu" and press Tab - should complete to common prefix "tabmulti_"
      await terminal.write("cat tabmu")
      await terminal.write("\t")
      
      await new Promise((resolve) => setTimeout(resolve, 300))

      const finalOutput = output.join("")

      // Should have completed - the full text "tabmulti_" appears in output
      // (possibly with bell character interspersed)
      // Remove control characters to check the actual text
      const textOnly = finalOutput.replace(/[\x00-\x1f]/g, "")
      expect(textOnly).toContain("tabmulti_")
      
      // Bash rings bell (\x07) when there are multiple completions
      // This indicates ambiguity
      expect(finalOutput).toContain("\x07")

      await sharedComputer.disposeTerminal(terminal.id)
    })
  })

  // ============================================================================
  // Integration Tests (use shared container)
  // ============================================================================

  describe("integration", () => {
    test("file written via terminal is readable via filesystem API", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      const terminal = await sharedComputer.createTerminal()

      await terminal.write("echo 'created by terminal' > int_terminal_file.txt\n")
      await new Promise((resolve) => setTimeout(resolve, 300))

      await sharedComputer.disposeTerminal(terminal.id)

      const result = await sharedComputer.files.read("int_terminal_file.txt")
      expect((result.content as string).trim()).toBe("created by terminal")
    })

    test("file written via filesystem API is accessible in terminal", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      await sharedComputer.files.write("int_api_file.txt", "created by API")

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await terminal.write("cat int_api_file.txt\n")
      await new Promise((resolve) => setTimeout(resolve, 300))

      await sharedComputer.disposeTerminal(terminal.id)

      expect(output.join("")).toContain("created by API")
    })

    test("runs Python script that processes files", async () => {
      if (skipIfUnavailable() || !sharedComputer) return

      // Write a Python script
      await sharedComputer.files.write(
        "int_process.py",
        `
import json

data = {"message": "processed by python", "numbers": [1, 2, 3]}
with open("int_output.json", "w") as f:
    json.dump(data, f)
print("Script completed")
`
      )

      const terminal = await sharedComputer.createTerminal()
      const output: string[] = []

      terminal.onData((data) => {
        output.push(data)
      })

      await terminal.write("python3 int_process.py\n")
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await sharedComputer.disposeTerminal(terminal.id)

      // Verify output file was created
      const result = await sharedComputer.files.read("int_output.json")
      const parsed = JSON.parse(result.content as string)
      expect(parsed.message).toBe("processed by python")
      expect(parsed.numbers).toEqual([1, 2, 3])
    })
  })
})
