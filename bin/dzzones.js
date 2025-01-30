#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

const program = new Command();

program
  .name('dzzones')
  .description('Compute minimal number of circles to cover area determined by objects')
  .option('-i, --input <file>', 'Input JSON file with objects')
  .option('-r, --radius <number>', 'Maximum circle radius', parseFloat)
  .option('-t, --type <type>', 'Type of the zone')
  .option('-s, --sid <sid>', 'SID of the zone');

program.parse(process.argv);

const options = program.opts();

if (!options.input) {
  console.error('Input file is required. Use -i or --input to specify the input file.');
  process.exit(1);
}

if (!options.radius || isNaN(options.radius) || options.radius <= 0) {
  console.error('Maximum circle radius is required and must be a positive number. Use -r or --radius to specify the radius.');
  process.exit(1);
}

if (!options.type) {
  console.error('Zone type is required. Use -t or --type to specify the type.');
  process.exit(1);
}

if (!options.sid) {
  console.error('SID is required. Use -s or --sid to specify the SID.');
  process.exit(1);
}

const inputFile = path.resolve(process.cwd(), options.input);
const maxRadius = options.radius;
const zoneType = options.type;
const sid = options.sid;

fs.readFile(inputFile, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading input file: ${err}`);
    process.exit(1);
  }

  let jsonData;
  try {
    jsonData = JSON.parse(data);
  } catch (parseErr) {
    console.error(`Error parsing JSON: ${parseErr}`);
    process.exit(1);
  }

  const positions = jsonData.Objects.map(obj => {
    // Corrected the coordinate order: [x, z, y]
    const [x, z, y] = obj.pos;
    return { x, y, z }; // Map positions to { x, y, z }
  });

  // Project to 2D using x and y coordinates (horizontal plane)
  const points = positions.map(pos => ({ x: pos.x, y: pos.y }));

  // Compute the minimal number of circles
  const circles = computeMinimumCircles(points, maxRadius);

  // Output the circles as SQL insert statements
  circles.forEach(circle => {
    const sql = `insert into dayz_zones (ztype, zcoordsx, zcoordsy, zradius, sid)
values ('${zoneType}', ${circle.center.x}, ${circle.center.y}, ${circle.radius}, ${sid});`;
    console.log(sql);
  });
});

function computeMinimumCircles(points, maxRadius) {
  const uncoveredPoints = [...points];
  const circles = [];

  while (uncoveredPoints.length > 0) {
    let bestCircle = null;
    let maxCovered = 0;

    for (let i = 0; i < uncoveredPoints.length; i++) {
      const center = uncoveredPoints[i];
      const coveredPoints = [];

      for (let j = 0; j < uncoveredPoints.length; j++) {
        const point = uncoveredPoints[j];
        const distance = Math.hypot(point.x - center.x, point.y - center.y);

        if (distance <= maxRadius) {
          coveredPoints.push(point);
        }
      }

      if (coveredPoints.length > maxCovered) {
        maxCovered = coveredPoints.length;
        bestCircle = {
          center,
          radius: maxRadius,
          points: coveredPoints
        };
      }
    }

    // Remove covered points from the list
    bestCircle.points.forEach(pt => {
      const index = uncoveredPoints.indexOf(pt);
      if (index !== -1) {
        uncoveredPoints.splice(index, 1);
      }
    });

    circles.push(bestCircle);
  }

  return circles;
}
