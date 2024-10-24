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
 * Parses and validates command-line arguments.
 * @returns {Object} An object containing the targetPath and warp coordinates.
 */
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: dzwarp <targetPath> <warpPos0> <warpPos2> [warpPos1]');
    process.exit(1);
  }

  const [targetPath, warpPos0Str, warpPos2Str, warpPos1Str] = args;

  const warpPos0 = parseFloat(warpPos0Str);
  const warpPos2 = parseFloat(warpPos2Str);
  const warpPos1 = warpPos1Str !== undefined ? parseFloat(warpPos1Str) : null;

  if (
    isNaN(warpPos0) ||
    isNaN(warpPos2) ||
    (warpPos1Str !== undefined && isNaN(warpPos1))
  ) {
    console.error(
      'Error: warpPos0, warpPos2, and warpPos1 (if provided) must be valid numbers.'
    );
    process.exit(1);
  }

  return { targetPath, warpPos0, warpPos2, warpPos1 };
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
 * Warps the positions of objects in the JSON data based on the warp target.
 * The first object's position is treated as the reference point.
 * @param {Array} objects - The array of objects to warp.
 * @param {number} warpPos0 - The target value for pos[0] of the reference object.
 * @param {number} warpPos2 - The target value for pos[2] of the reference object.
 * @param {number|null} warpPos1 - The target value for pos[1] of the reference object, if provided.
 * @returns {Array} The updated array of objects.
 */
function warpObjects(objects, warpPos0, warpPos2, warpPos1) {
  if (objects.length === 0) {
    console.warn('Warning: No objects found to warp.');
    return objects;
  }

  // Reference object (first object)
  const refObject = objects[0];
  if (!Array.isArray(refObject.pos) || refObject.pos.length < 3) {
    console.error(
      `Error: The reference object "${refObject.name}" does not have a valid pos array.`
    );
    process.exit(1);
  }

  const currentPos0 = refObject.pos[0];
  const currentPos2 = refObject.pos[2];
  const currentPos1 = warpPos1 !== null ? refObject.pos[1] : 0; // Default to 0 if warpPos1 is not provided

  // Calculate translation vector
  const deltaX = warpPos0 - currentPos0;
  const deltaY = warpPos1 !== null ? warpPos1 - currentPos1 : 0;
  const deltaZ = warpPos2 - currentPos2;

  console.log('Translation Vector:');
  console.log(`  X: ${deltaX}`);
  console.log(`  Y: ${deltaY}`);
  console.log(`  Z: ${deltaZ}`);

  // Apply translation to all objects
  return objects.map((obj) => {
    if (Array.isArray(obj.pos) && obj.pos.length >= 3) {
      obj.pos[0] += deltaX;
      obj.pos[2] += deltaZ;
      if (warpPos1 !== null && typeof deltaY === 'number') {
        obj.pos[1] += deltaY;
      }
    } else {
      console.warn(
        `Warning: Object "${obj.name}" does not have a valid pos array.`
      );
    }
    return obj;
  });
}

/**
 * The main function that orchestrates reading, warping, and writing the JSON data.
 */
async function main() {
  const { targetPath, warpPos0, warpPos2, warpPos1 } = parseArguments();

  try {
    const absolutePath = path.resolve(process.cwd(), targetPath);
    const data = await fs.readFile(absolutePath, 'utf-8');
    const json = JSON.parse(data);

    if (!Array.isArray(json.Objects)) {
      console.error('Error: JSON does not contain an "Objects" array.');
      process.exit(1);
    }

    const warpedObjects = warpObjects(json.Objects, warpPos0, warpPos2, warpPos1);
    json.Objects = warpedObjects;

    const outputPath = getOutputPath(absolutePath);
    await fs.writeFile(outputPath, JSON.stringify(json, null, 4), 'utf-8');

    console.log(`Warped data written to ${outputPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
