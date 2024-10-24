#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Helper to get __dirname in ES modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses and validates command-line arguments using flags.
 * Supports either warp coordinates (-x, -y, -z) or a warped set file (-iw), but not both.
 * Also supports output directory (-o) and additional offsets (-xo, -yo, -zo).
 * @returns {Object} An object containing all relevant flags and their values.
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const argMap = {};

    // Iterate through the arguments and map flags to their values
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-is':
                argMap.inputSetPath = args[++i];
                break;
            case '-isr':
                argMap.inputSetRelationDir = args[++i];
                break;
            case '-x':
                argMap.warpX = parseFloat(args[++i]);
                break;
            case '-y':
                argMap.warpY = parseFloat(args[++i]);
                break;
            case '-z':
                argMap.warpZ = parseFloat(args[++i]);
                break;
            case '-iw':
                argMap.warpSetPath = args[++i];
                break;
            case '-o':
                argMap.outputDir = args[++i];
                break;
            case '-xo':
                argMap.offsetX = parseFloat(args[++i]);
                break;
            case '-yo':
                argMap.offsetY = parseFloat(args[++i]);
                break;
            case '-zo':
                argMap.offsetZ = parseFloat(args[++i]);
                break;
            case '--help':
            case '-h':
                displayUsageAndExit();
                break;
            default:
                console.error(`Unknown argument: ${arg}`);
                displayUsageAndExit();
        }
    }

    // Check for mutually exclusive options
    const hasWarpCoordinates = ('warpX' in argMap) || ('warpY' in argMap) || ('warpZ' in argMap);
    const hasWarpSet = 'warpSetPath' in argMap;

    if (hasWarpCoordinates && hasWarpSet) {
        console.error('Error: Provide either warp coordinates (-x, -y, -z) or a warped set file (-iw), but not both.');
        displayUsageAndExit();
    }

    // Validate required arguments
    if (!argMap.inputSetPath) {
        console.error('Error: Missing required flag -is <inputSetPath>');
        displayUsageAndExit();
    }

    if (!hasWarpCoordinates && !hasWarpSet) {
        console.error('Error: You must provide either warp coordinates (-x, -y, -z) or a warped set file (-iw).');
        displayUsageAndExit();
    }

    // If warp coordinates are provided, ensure all are present
    if (hasWarpCoordinates) {
        if (!('warpX' in argMap) || !('warpY' in argMap) || !('warpZ' in argMap)) {
            console.error('Error: Flags -x, -y, and -z must all be provided when specifying warp coordinates.');
            displayUsageAndExit();
        }
        if (isNaN(argMap.warpX) || isNaN(argMap.warpY) || isNaN(argMap.warpZ)) {
            console.error('Error: Flags -x, -y, and -z must be provided with valid numbers.');
            process.exit(1);
        }
    }

    // If offsets are provided, ensure they are numbers
    if ('offsetX' in argMap && isNaN(argMap.offsetX)) {
        console.error('Error: Flag -xo must be provided with a valid number.');
        process.exit(1);
    }
    if ('offsetY' in argMap && isNaN(argMap.offsetY)) {
        console.error('Error: Flag -yo must be provided with a valid number.');
        process.exit(1);
    }
    if ('offsetZ' in argMap && isNaN(argMap.offsetZ)) {
        console.error('Error: Flag -zo must be provided with a valid number.');
        process.exit(1);
    }

    return argMap;
}

/**
 * Displays usage instructions and exits the program.
 */
function displayUsageAndExit() {
    console.error(`
Usage:
  dzwarp -is <inputSetPath> [-isr <inputSetRelationDir>] [-o <outputDirectory>] [(-x <warpX> -y <warpY> -z <warpZ> | -iw <warpSetPath>)] [-xo <offsetX> -yo <offsetY> -zo <offsetZ>]

Flags:
  -is <path>          Input Set: Path to the primary JSON file to warp. (Required)
  -isr <directory>    Input Set Relation Directory: Path to a directory containing additional JSON files to warp in relation to the primary set. (Optional)
  
  -x <number>         Warp coordinate for the X-axis. (Required if not using -iw)
  -y <number>         Warp coordinate for the Y-axis. (Required if not using -iw)
  -z <number>         Warp coordinate for the Z-axis. (Required if not using -iw)
  
  -iw <path>          Warp Set: Path to a JSON file representing the desired warped state of the input set. (Optional)
  
  -o <directory>      Output Directory: Directory where warped files will be saved. If it doesn't exist, it will be created. (Optional)
  
  -xo <number>        Offset for the X-axis after warping. (Optional)
  -yo <number>        Offset for the Y-axis after warping. (Optional)
  -zo <number>        Offset for the Z-axis after warping. (Optional)
  
  --help, -h          Display this help message.

Examples:
  # Warp using coordinates and specify an output directory with offsets
  dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -o ./warped -x -3333.3 -y -4444.4 -z -12.0 -xo 55.5 -yo 77.7 -zo -10.1

  # Warp using a warped set file and specify an output directory
  dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -o ./warped -iw ./my-sets/my-warped-sets.json
`);
    process.exit(1);
}

/**
 * Generates the output file path by adding a '-warp' suffix before the file extension.
 * @param {string} inputPath - The original file path.
 * @param {string} outputDir - The output directory where the warped file will be saved.
 * @returns {string} The new file path with the '-warp' suffix in the output directory.
 */
function getOutputPath(inputPath, outputDir) {
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    return path.join(outputDir, `${base}-warp${ext}`);
}

/**
 * Warps the positions of objects in the JSON data based on the translation vector.
 * @param {Array} objects - The array of objects to warp.
 * @param {number} deltaX - The translation value for pos[0].
 * @param {number} deltaY - The translation value for pos[1].
 * @param {number} deltaZ - The translation value for pos[2].
 * @returns {Array} The updated array of objects.
 */
function warpObjects(objects, deltaX, deltaY, deltaZ) {
    return objects.map((obj) => {
        if (Array.isArray(obj.pos) && obj.pos.length >= 3) {
            obj.pos[0] += deltaX;
            obj.pos[1] += deltaY;
            obj.pos[2] += deltaZ;
        } else {
            console.warn(`Warning: Object "${obj.name}" does not have a valid pos array.`);
        }
        return obj;
    });
}

/**
 * Reads and parses a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Object} The parsed JSON object.
 */
async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading or parsing JSON file at ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Writes a JSON object to a file with the specified path.
 * @param {string} filePath - The path to write the JSON file.
 * @param {Object} jsonData - The JSON data to write.
 */
async function writeJSON(filePath, jsonData) {
    try {
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 4), 'utf-8');
        console.log(`Warped data written to ${filePath}`);
    } catch (error) {
        console.error(`Error writing JSON file at ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Calculates the translation vector based on warp coordinates or a warp set.
 * @param {Object} args - Parsed command-line arguments.
 * @param {Object} primaryJSON - The primary input set JSON object.
 * @returns {Object} An object containing deltaX, deltaY, and deltaZ.
 */
async function calculateTranslationVector(args, primaryJSON) {
    let deltaX = 0;
    let deltaY = 0;
    let deltaZ = 0;

    if (args.warpSetPath) {
        // Warp using a warped set file
        const absoluteWarpSetPath = path.resolve(process.cwd(), args.warpSetPath);
        const warpJSON = await readJSON(absoluteWarpSetPath);

        if (!Array.isArray(warpJSON.Objects)) {
            console.error('Error: Warp JSON does not contain an "Objects" array.');
            process.exit(1);
        }

        if (warpJSON.Objects.length === 0) {
            console.error('Error: Warp "Objects" array is empty.');
            process.exit(1);
        }

        const warpReferenceObject = warpJSON.Objects[0];
        if (!Array.isArray(warpReferenceObject.pos) || warpReferenceObject.pos.length < 3) {
            console.error(`Error: Reference object "${warpReferenceObject.name}" in warp set does not have a valid pos array.`);
            process.exit(1);
        }

        const primaryReferenceObject = primaryJSON.Objects[0];
        const warpReferencePos = warpReferenceObject.pos;
        const primaryReferencePos = primaryReferenceObject.pos;

        deltaX = warpReferencePos[0] - primaryReferencePos[0];
        deltaY = warpReferencePos[1] - primaryReferencePos[1];
        deltaZ = warpReferencePos[2] - primaryReferencePos[2];

        console.log('Calculated Translation Vector based on warp set:');
        console.log(`  X: ${deltaX}`);
        console.log(`  Y: ${deltaY}`);
        console.log(`  Z: ${deltaZ}`);
    } else {
        // Warp using provided coordinates
        const primaryReferencePos = primaryJSON.Objects[0].pos;
        deltaX = args.warpX - primaryReferencePos[0];
        deltaY = args.warpY - primaryReferencePos[1];
        deltaZ = args.warpZ - primaryReferencePos[2];

        console.log('Calculated Translation Vector based on provided coordinates:');
        console.log(`  X: ${deltaX}`);
        console.log(`  Y: ${deltaY}`);
        console.log(`  Z: ${deltaZ}`);
    }

    return { deltaX, deltaY, deltaZ };
}

/**
 * Applies additional offsets to the translation vector.
 * @param {Object} delta - The original translation vector.
 * @param {Object} offsets - The additional offsets.
 * @returns {Object} The updated translation vector with offsets applied.
 */
function applyOffsets(delta, offsets) {
    const { deltaX, deltaY, deltaZ } = delta;
    const { offsetX = 0, offsetY = 0, offsetZ = 0 } = offsets;

    const newDeltaX = deltaX + offsetX;
    const newDeltaY = deltaY + offsetY;
    const newDeltaZ = deltaZ + offsetZ;

    console.log('Final Translation Vector after applying offsets:');
    console.log(`  X: ${newDeltaX}`);
    console.log(`  Y: ${newDeltaY}`);
    console.log(`  Z: ${newDeltaZ}`);

    return { newDeltaX, newDeltaY, newDeltaZ };
}

/**
 * Ensures that the output directory exists. If it doesn't, creates it.
 * @param {string} outputDir - The path to the output directory.
 */
async function ensureOutputDirectory(outputDir) {
    try {
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Output directory is set to: ${outputDir}`);
    } catch (error) {
        console.error(`Error creating output directory at ${outputDir}: ${error.message}`);
        process.exit(1);
    }
}

/**
 * The main function that orchestrates reading, warping, and writing the JSON data.
 */
async function main() {
    const args = parseArguments();

    // Read the primary input set
    const absoluteInputSetPath = path.resolve(process.cwd(), args.inputSetPath);
    const primaryJSON = await readJSON(absoluteInputSetPath);

    if (!Array.isArray(primaryJSON.Objects)) {
        console.error('Error: Primary JSON does not contain an "Objects" array.');
        process.exit(1);
    }

    // Identify the reference object (first object)
    if (primaryJSON.Objects.length === 0) {
        console.error('Error: Primary "Objects" array is empty.');
        process.exit(1);
    }

    const primaryReferenceObject = primaryJSON.Objects[0];
    if (!Array.isArray(primaryReferenceObject.pos) || primaryReferenceObject.pos.length < 3) {
        console.error(`Error: Reference object "${primaryReferenceObject.name}" does not have a valid pos array.`);
        process.exit(1);
    }

    // Calculate translation vector
    const { deltaX, deltaY, deltaZ } = await calculateTranslationVector(args, primaryJSON);

    // Apply additional offsets if provided
    const offsets = {
        offsetX: args.offsetX || 0,
        offsetY: args.offsetY || 0,
        offsetZ: args.offsetZ || 0
    };

    const { newDeltaX, newDeltaY, newDeltaZ } = applyOffsets(
        { deltaX, deltaY, deltaZ },
        offsets
    );

    // Determine output directory
    let outputDir = path.dirname(absoluteInputSetPath); // Default to input file's directory
    if (args.outputDir) {
        outputDir = path.resolve(process.cwd(), args.outputDir);
        await ensureOutputDirectory(outputDir);
    }

    // Warp the primary input set
    const warpedPrimaryObjects = warpObjects(primaryJSON.Objects, newDeltaX, newDeltaY, newDeltaZ);
    primaryJSON.Objects = warpedPrimaryObjects;

    const primaryOutputPath = getOutputPath(absoluteInputSetPath, outputDir);
    await writeJSON(primaryOutputPath, primaryJSON);

    // If input set relation directory is provided, process additional sets
    if (args.inputSetRelationDir) {
        const absoluteRelationDir = path.resolve(process.cwd(), args.inputSetRelationDir);
        let files;
        try {
            files = await fs.readdir(absoluteRelationDir);
        } catch (error) {
            console.error(`Error reading directory ${absoluteRelationDir}: ${error.message}`);
            process.exit(1);
        }

        // Filter JSON files excluding the primary input set and warp set
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');

        for (const file of jsonFiles) {
            const filePath = path.join(absoluteRelationDir, file);

            // Skip the primary input set and warp set if it's within the relation directory
            if (path.resolve(filePath) === path.resolve(absoluteInputSetPath) ||
                (args.warpSetPath && path.resolve(filePath) === path.resolve(args.warpSetPath))) {
                continue;
            }

            const jsonData = await readJSON(filePath);

            if (!Array.isArray(jsonData.Objects)) {
                console.warn(`Warning: JSON file "${file}" does not contain an "Objects" array. Skipping.`);
                continue;
            }

            // Warp the additional set
            const warpedObjects = warpObjects(jsonData.Objects, newDeltaX, newDeltaY, newDeltaZ);
            jsonData.Objects = warpedObjects;

            const outputPath = getOutputPath(filePath, outputDir);
            await writeJSON(outputPath, jsonData);
        }
    }
}

main();
