# dzwarp

![npm](https://img.shields.io/npm/v/dzwarp)
![License](https://img.shields.io/npm/l/dzwarp)
![Node.js](https://img.shields.io/node/v/dzwarp)

**dzwarp** is a powerful command-line tool designed to warp the positions of JSON objects within a dataset. Whether you're relocating complex structures or maintaining the relative positions of multiple object sets, `dzwarp` ensures precise and efficient transformations using simple command-line flags.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Flags](#flags)
  - [Examples](#examples)
- [JSON Structure](#json-structure)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Flag-Based Parameters**: Intuitive and flexible flag-based input for specifying warp parameters.
- **Supports Negative Coordinates**: Seamlessly handle both positive and negative warp values.
- **Relational Warp**: Warp multiple JSON files in relation to a primary set, maintaining their spatial relationships.
- **Automatic Output Generation**: Outputs warped JSON files with a `-warp` suffix to preserve original data.
- **Robust Error Handling**: Provides clear and descriptive error messages for invalid inputs or operations.

## Installation

Ensure you have [Node.js](https://nodejs.org/) installed (version 14 or higher is recommended).

You can install `dzwarp` globally using npm:

```bash
npm install -g dzwarp
```

Alternatively, install it locally within your project:

```bash
npm install dzwarp
```

## Usage

After installation, you can use `dzwarp` via the command line.

### Command Syntax

```bash
dzwarp -is <inputSetPath> [-isr <inputSetRelationDir>] -x <warpX> -y <warpY> -z <warpZ>
```

### Flags

- `-is <path>` **(Required)**  
  **Input Set**: Path to the primary JSON file to warp.

- `-isr <directory>` **(Optional)**  
  **Input Set Relation Directory**: Path to a directory containing additional JSON files to warp in relation to the primary set.

- `-x <number>` **(Required)**  
  Warp coordinate for the **X-axis**.

- `-y <number>` **(Required)**  
  Warp coordinate for the **Y-axis**.

- `-z <number>` **(Required)**  
  Warp coordinate for the **Z-axis**.

### Description of Flags

- **Primary Input Set (`-is`)**:  
  Specifies the main JSON file whose objects will be warped. This set serves as the reference point for any additional sets.

- **Input Set Relation Directory (`-isr`)**:  
  When provided, all JSON files within this directory (excluding the primary input set if present) will also be warped. Their positions will be adjusted relative to the warped primary set, maintaining their spatial relationships.

- **Warp Coordinates (`-x`, `-y`, `-z`)**:  
  Define the target warp coordinates. These values determine how the objects' positions are translated along each axis. Negative values are fully supported, allowing for movement in any direction.

### Examples

#### Warp a Single JSON File

Warp the positions in `my-objects.json` by moving objects to the coordinates `(3333.3, 4444.4, 12.0)`.

```bash
dzwarp -is ./my-objects.json -x 3333.3 -y 4444.4 -z 12.0
```

**Result:**  
A new file `my-objects-warp.json` is created with updated object positions.

#### Warp a Primary Set and Additional Sets

Warp the primary set `my-objects.json` and all additional JSON files within the `./my-sets/` directory by moving objects to the coordinates `(-3333.3, -4444.4, -12.0)`.

```bash
dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -x -3333.3 -y -4444.4 -z -12.0
```

**Result:**  
- `my-objects-warp.json` is created with updated positions.
- Each JSON file within `./my-sets/` (excluding `my-objects.json` if present) has a corresponding `-warp.json` file with updated positions.

#### Handling Negative Warp Coordinates

Warp the positions in `example.json` by moving objects to the coordinates `(-1000.0, 2000.0, -3000.0)`.

```bash
dzwarp -is ./example.json -x -1000.0 -y 2000.0 -z -3000.0
```

**Result:**  
A new file `example-warp.json` is created with objects' `pos` arrays adjusted by the specified deltas.

### Sample Command

```bash
dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -x -3333.3 -y -4444.4 -z -12.0
```

## JSON Structure

`dzwarp` expects JSON files to follow a specific structure. Below is an example:

```json
{
    "Objects": [
        {
            "name": "StaticObj_Pier_Concrete3_2",
            "pos": [
                7657.6689453125,
                23.125747680664064,
                2383.624755859375
            ],
            "ypr": [
                -65.184326171875,
                0.0,
                10.999998092651368
            ],
            "scale": 1.0,
            "enableCEPersistency": 0
        },
        {
            "name": "StaticObj_Pier_Concrete3_2",
            "pos": [
                7674.1142578125,
                15.507190704345704,
                2419.2451171875
            ],
            "ypr": [
                -65.184326171875,
                0.0,
                10.999998092651368
            ],
            "scale": 1.0,
            "enableCEPersistency": 0
        },
        {
            "name": "StaticObj_Pier_Concrete3_2",
            "pos": [
                7690.13134765625,
                8.057212829589844,
                2454.010498046875
            ],
            "ypr": [
                -65.184326171875,
                0.0,
                10.999998092651368
            ],
            "scale": 1.0,
            "enableCEPersistency": 0
        }
    ]
}
```

**Key Elements:**

- **`Objects`**: An array of object definitions.
  - **`name`**: The name identifier of the object.
  - **`pos`**: An array representing the position coordinates `[X, Y, Z]`.
  - **`ypr`**: An array representing yaw, pitch, and roll.
  - **`scale`**: The scale factor of the object.
  - **`enableCEPersistency`**: A flag indicating persistence (context-specific).

**Note:**  
Each object must have a `pos` array with at least three numerical values corresponding to the X, Y, and Z coordinates.

## Error Handling

`dzwarp` includes robust error handling to ensure smooth operation:

- **Missing Required Flags**:  
  If the required `-is`, `-x`, `-y`, or `-z` flags are missing, the tool will display an error message and terminate.

- **Invalid File Paths**:  
  If the specified input set (`-is`) or input set relation directory (`-isr`) does not exist or is inaccessible, an error message will be displayed.

- **Malformed JSON**:  
  If the JSON files are improperly formatted or do not contain the expected `Objects` array, the tool will warn and skip processing those files.

- **Invalid Coordinates**:  
  If non-numeric values are provided for warp coordinates (`-x`, `-y`, `-z`), the tool will display an error message and terminate.

## Contributing

Contributions are welcome! If you have suggestions, bug reports, or want to contribute code, please follow these steps:

1. **Fork the Repository**

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m "Add your message here"
   ```

4. **Push to the Branch**

   ```bash
   git push origin feature/YourFeatureName
   ```

5. **Open a Pull Request**

Please ensure your code adheres to the existing style and includes relevant tests.

## License

This project is licensed under the [MIT License](LICENSE).

---