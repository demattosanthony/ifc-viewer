#!/usr/bin/env python3
import ifcopenshell

# Open the IFC file
ifc_file = ifcopenshell.open("../models/sample.ifc")

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