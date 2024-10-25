#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise, Builder } from 'xml2js';

/**
 * Helper to get __dirname in ES modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses and validates command-line arguments using flags.
 * Supports warp coordinates (-x, -y, -z) and a warped set file (-iw).
 * Also supports output directory (-o), additional offsets (-xo, -yo, -zo), and module type (-mod).
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
            case '-mod':
                argMap.module = args[++i].toLowerCase();
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

    // Validate required arguments
    if (!argMap.inputSetPath) {
        console.error('Error: Missing required flag -is <inputSetPath>');
        displayUsageAndExit();
    }

    // Validate that either warp coordinates or warp set is provided
    const hasWarpCoordinates = ('warpX' in argMap) && ('warpY' in argMap) && ('warpZ' in argMap);
    const hasWarpSet = 'warpSetPath' in argMap;

    if (!hasWarpCoordinates && !hasWarpSet) {
        console.error('Error: You must provide either warp coordinates (-x, -y, -z) or a warp set file (-iw).');
        displayUsageAndExit();
    }

    // If warp coordinates are provided, ensure they are numbers
    if (hasWarpCoordinates) {
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

    // If module is not specified, default to 'json'
    if (!('module' in argMap)) {
        argMap.module = 'json';
    }

    return argMap;
}

/**
 * Displays usage instructions and exits the program.
 */
function displayUsageAndExit() {
    console.error(`
Usage:
  dzwarp -is <inputSetPath> [-mod <module>] [-isr <inputSetRelationDir>] [-o <outputDirectory>] [(-x <warpX> -y <warpY> -z <warpZ> | -iw <warpSetPath>)] [-xo <offsetX> -yo <offsetY> -zo <offsetZ>] [--help | -h]

Flags:
  -is <path>          Input Set: Path to the primary JSON file to warp. (Required)
  -mod <module>       Module Type: Specify the module type. Supported modules: 'json', 'events'. (Default: 'json')
  -isr <directory>    Input Set Relation Directory: Path to a directory containing additional JSON or XML files to warp in relation to the primary set. (Optional)
  
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

  # Warp using coordinates and process both JSON and XML files in -isr with module 'events'
  dzwarp -is ./my-sets/my-objects.json -mod events -isr ./my-sets -o ./warped -x 1000.0 -y 2000.0 -z 3000.0
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
 * Reads and parses an XML file.
 * @param {string} filePath - The path to the XML file.
 * @returns {Object} The parsed XML object.
 */
async function readXML(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return await parseStringPromise(data, { explicitArray: false });
    } catch (error) {
        console.error(`Error reading or parsing XML file at ${filePath}: ${error.message}`);
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
 * Writes an XML object to a file with the specified path.
 * @param {string} filePath - The path to write the XML file.
 * @param {Object} xmlData - The XML data to write.
 */
async function writeXML(filePath, xmlData) {
    try {
        const builder = new Builder();
        const xml = builder.buildObject(xmlData);
        await fs.writeFile(filePath, xml, 'utf-8');
        console.log(`Warped XML data written to ${filePath}`);
    } catch (error) {
        console.error(`Error writing XML file at ${filePath}: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Calculates the translation vector based on warp coordinates or a warp set.
 * @param {Object} args - Parsed command-line arguments.
 * @param {Object} primaryData - The primary input set JSON object.
 * @param {Object} warpSetData - The warp set JSON object (if provided).
 * @returns {Object} An object containing deltaX, deltaY, and deltaZ.
 */
async function calculateTranslationVector(args, primaryData, warpSetData) {
    let deltaX = 0;
    let deltaY = 0;
    let deltaZ = 0;

    if (args.warpSetPath) {
        // Warp using a warped set file
        if (!Array.isArray(warpSetData.Objects)) {
            console.error('Error: Warp set JSON does not contain an "Objects" array.');
            process.exit(1);
        }

        if (warpSetData.Objects.length === 0) {
            console.error('Error: Warp set "Objects" array is empty.');
            process.exit(1);
        }

        const warpReferenceObject = warpSetData.Objects[0];
        if (!Array.isArray(warpReferenceObject.pos) || warpReferenceObject.pos.length < 3) {
            console.error(`Error: Reference object "${warpReferenceObject.name}" in warp set does not have a valid pos array.`);
            process.exit(1);
        }

        const primaryReferenceObject = primaryData.Objects[0];
        if (!Array.isArray(primaryReferenceObject.pos) || primaryReferenceObject.pos.length < 3) {
            console.error(`Error: Reference object "${primaryReferenceObject.name}" in primary set does not have a valid pos array.`);
            process.exit(1);
        }

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
        const primaryReferencePos = primaryData.Objects[0].pos;
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
 * Processes JSON input sets.
 * @param {Object} args - Parsed command-line arguments.
 * @param {Object} primaryJSON - The primary input set JSON object.
 * @param {Object} translation - The translation vector.
 * @param {string} outputDir - The output directory.
 */
async function processJSON(args, primaryJSON, translation, outputDir) {
    // Warp the primary input set
    const warpedPrimaryObjects = warpObjects(primaryJSON.Objects, translation.newDeltaX, translation.newDeltaY, translation.newDeltaZ);
    primaryJSON.Objects = warpedPrimaryObjects;

    const primaryOutputPath = getOutputPath(args.inputSetPath, outputDir);
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

        // Process both JSON and XML files
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
        const xmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.xml');

        // Process JSON files
        for (const file of jsonFiles) {
            const filePath = path.join(absoluteRelationDir, file);

            // Skip the primary input set and warp set if it's within the relation directory
            if (path.resolve(filePath) === path.resolve(args.inputSetPath) ||
                (args.warpSetPath && path.resolve(filePath) === path.resolve(args.warpSetPath))) {
                continue;
            }

            const jsonData = await readJSON(filePath);

            if (!Array.isArray(jsonData.Objects)) {
                console.warn(`Warning: JSON file "${file}" does not contain an "Objects" array. Skipping.`);
                continue;
            }

            // Warp the additional set
            const warpedObjects = warpObjects(jsonData.Objects, translation.newDeltaX, translation.newDeltaY, translation.newDeltaZ);
            jsonData.Objects = warpedObjects;

            const outputPath = getOutputPath(filePath, outputDir);
            await writeJSON(outputPath, jsonData);
        }

        // Process XML files
        for (const file of xmlFiles) {
            const filePath = path.join(absoluteRelationDir, file);

            const xmlData = await readXML(filePath);

            // Determine the XML structure based on the module
            if (args.module === 'events') {
                await processXMLFile(xmlData, filePath, outputDir, translation);
            } else {
                console.warn(`Warning: XML file "${file}" encountered but no module specified to handle it. Skipping.`);
            }
        }
    }
}

/**
 * Processes a single XML file based on the module type.
 * @param {Object} xmlData - The parsed XML data.
 * @param {string} filePath - The path to the XML file.
 * @param {string} outputDir - The output directory.
 * @param {Object} translation - The translation vector.
 */
async function processXMLFile(xmlData, filePath, outputDir, translation) {
    // For 'events' module, process the XML structure accordingly

    // Check if 'eventposdef' and 'event' elements exist
    if (!xmlData.eventposdef || !xmlData.eventposdef.event) {
        console.warn(`Warning: XML file "${path.basename(filePath)}" does not contain <eventposdef> with <event> elements. Skipping.`);
        return;
    }

    // Ensure 'event' is an array
    const events = Array.isArray(xmlData.eventposdef.event) ? xmlData.eventposdef.event : [xmlData.eventposdef.event];

    // Filter events whose name starts with 'VehicleTrd'
    const targetEvents = events.filter(event => event.$.name.startsWith('VehicleTrd'));

    if (targetEvents.length === 0) {
        console.warn(`Warning: No events starting with "VehicleTrd" found in XML file "${path.basename(filePath)}". Skipping.`);
        return;
    }

    // Process each target event
    for (const event of targetEvents) {
        if (!event.pos) continue;

        // Ensure 'pos' is an array
        const posArray = Array.isArray(event.pos) ? event.pos : [event.pos];

        for (const pos of posArray) {
            // Parse original coordinates
            const originalX = parseFloat(pos.$.x);
            const originalY = parseFloat(pos.$.y);
            const originalZ = parseFloat(pos.$.z);

            // Apply translation vector
            const newX = originalX + translation.newDeltaX;
            const newY = originalY + translation.newDeltaY;
            const newZ = originalZ + translation.newDeltaZ;

            // Update the pos attributes
            pos.$.x = newX.toFixed(4);
            pos.$.y = newY.toFixed(4);
            pos.$.z = newZ.toFixed(4);
        }
    }

    // Determine output path
    const outputPath = getOutputPath(filePath, outputDir);
    await writeXML(outputPath, xmlData);
}

/**
 * The main function that orchestrates reading, warping, and writing the JSON/XML data.
 */
async function main() {
    const args = parseArguments();

    // Determine output directory
    let outputDir = path.dirname(path.resolve(process.cwd(), args.inputSetPath)); // Default to input file's directory
    if (args.outputDir) {
        outputDir = path.resolve(process.cwd(), args.outputDir);
        await ensureOutputDirectory(outputDir);
    }

    // Read the primary input set (assumed to be JSON)
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

    // Read the warp set if provided
    let warpSetData = null;
    if (args.warpSetPath) {
        const absoluteWarpSetPath = path.resolve(process.cwd(), args.warpSetPath);
        warpSetData = await readJSON(absoluteWarpSetPath);
    }

    // Calculate translation vector
    const { deltaX, deltaY, deltaZ } = await calculateTranslationVector(args, primaryJSON, warpSetData);

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

    const translation = { newDeltaX, newDeltaY, newDeltaZ };

    // Process input sets
    await processJSON(args, primaryJSON, translation, outputDir);
}

main();

// dzwarp -is ./custom/kb-sz-cherno-0303.json -isr ./custom -iw ./kb-sz-platform-sahkal-1024.json -o ./warped -xo 949.6357421875 -yo 12.3486442566 -zo 55.0546875
// dzwarp -mod events -is ./custom/kb-sz-cherno-0303.json -isr ./custom -iw ./kb-sz-platform-sahkal-1024.json -o ./warped -xo 949.6357421875 -yo 12.3486442566 -zo 55.0546875
