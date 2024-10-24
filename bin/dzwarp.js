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
 * @returns {Object} An object containing inputSetPath, inputSetRelationDir, warp coordinates, and warpSetPath.
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

    // If warp set is provided, validate it will be handled later
    if (hasWarpSet) {
        // No immediate validation; will validate in main()
    }

    return argMap;
}

/**
 * Displays usage instructions and exits the program.
 */
function displayUsageAndExit() {
    console.error(`
Usage:
  dzwarp -is <inputSetPath> [-isr <inputSetRelationDir>] (-x <warpX> -y <warpY> -z <warpZ> | -iw <warpSetPath>)

Flags:
  -is <path>          Input Set: Path to the primary JSON file to warp. (Required)
  -isr <directory>    Input Set Relation Directory: Path to a directory containing additional JSON files to warp in relation to the primary set. (Optional)
  
  -x <number>         Warp coordinate for the X-axis. (Required if not using -iw)
  -y <number>         Warp coordinate for the Y-axis. (Required if not using -iw)
  -z <number>         Warp coordinate for the Z-axis. (Required if not using -iw)
  
  -iw <path>          Warp Set: Path to a JSON file representing the desired warped state of the input set. (Optional)

Examples:
  # Warp using coordinates
  dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -x -3333.3 -y -4444.4 -z -12.0

  # Warp using a warped set file
  dzwarp -is ./my-sets/my-objects.json -isr ./my-sets -iw ./my-sets/my-warped-sets.json
`);
    process.exit(1);
}

/**
 * Generates the output file path by adding a '-warp' suffix before the file extension.
 * @param {string} inputPath - The original file path.
 * @returns {string} The new file path with the '-warp' suffix.
 */
function getOutputPath(inputPath) {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    return path.join(dir, `${base}-warp${ext}`);
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

        console.log('Translation Vector based on provided coordinates:');
        console.log(`  X: ${deltaX}`);
        console.log(`  Y: ${deltaY}`);
        console.log(`  Z: ${deltaZ}`);
    }

    return { deltaX, deltaY, deltaZ };
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

    // Warp the primary input set
    const warpedPrimaryObjects = warpObjects(primaryJSON.Objects, deltaX, deltaY, deltaZ);
    primaryJSON.Objects = warpedPrimaryObjects;

    const primaryOutputPath = getOutputPath(absoluteInputSetPath);
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

        // Filter JSON files excluding the primary input set
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
            const warpedObjects = warpObjects(jsonData.Objects, deltaX, deltaY, deltaZ);
            jsonData.Objects = warpedObjects;

            const outputPath = getOutputPath(filePath);
            await writeJSON(outputPath, jsonData);
        }
    }
}

main();
