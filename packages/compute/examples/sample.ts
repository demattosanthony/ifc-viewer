import { createLocalComputer } from "../src";

const computer = await createLocalComputer({
  workingDirectory: `${Bun.env.HOME}/ifc-workspace`,
  cleanup: false,
});

const ifcFile = Bun.file(
  `${Bun.env.HOME}/ifc-viewer/apps/playground/public/sample.ifc`
);
const ifcContent = await ifcFile.arrayBuffer();

await computer.files.write("sample.ifc", new Uint8Array(ifcContent));

const terminal = await computer.createTerminal();

terminal.onData((data: string) => {
  process.stdout.write(data);
});

const exitPromise = new Promise<number>((resolve) => {
  terminal.onExit(resolve);
});

// Create a simple ifcopenshell Python script
const pythonScript = `#!/usr/bin/env python3
import ifcopenshell

# Open the IFC file
ifc_file = ifcopenshell.open("sample.ifc")

# Print basic file information
print("=" * 60)
print("IFC File Information")
print("=" * 60)
print(f"Schema: {ifc_file.schema}")

# Count all entities in the file
all_entities = ifc_file.by_type("IfcRoot")
print(f"Total IFC Entities: {len(all_entities)}")
print()

# Get project information
project = ifc_file.by_type("IfcProject")[0]
print(f"Project Name: {project.Name}")
print(f"Project Description: {project.Description}")
print()

# List all building storeys
print("Building Storeys:")
print("-" * 40)
storeys = ifc_file.by_type("IfcBuildingStorey")
for storey in storeys:
    print(f"  - {storey.Name or 'Unnamed Storey'}")
print()

# Count different element types
print("Element Type Summary:")
print("-" * 40)
element_types = ["IfcWall", "IfcWindow", "IfcDoor", "IfcSlab", "IfcColumn", "IfcBeam"]
for elem_type in element_types:
    elements = ifc_file.by_type(elem_type)
    if elements:
        print(f"  {elem_type}: {len(elements)}")
print()

print("=" * 60)
print("Script completed successfully!")
print("=" * 60)
`;

// Write the Python script to the working directory
await computer.files.write("analyze_ifc.py", pythonScript);

// Run the Python script
await terminal.write("python3 analyze_ifc.py\n");
await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for script execution

await terminal.write("exit\n");

await exitPromise;
await computer.dispose();
