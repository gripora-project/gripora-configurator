import * as THREE from "three";

// The attitude preview's model: a simple car built from three.js primitives,
// so there is no model file to load. Same convention as the old aircraft
// model: Y is up, the nose points to -Z (away from the camera, so the preview
// shows the car from behind), about 6 units long before the caller's scale.

const COLORS = {
  body: 0xff5f1f, // Gripora orange
  chassis: 0x23272f, // Gripora ink, lifted
  glass: 0x1b1e24,
  tyre: 0x141518,
  rim: 0x9aa1ad,
  light: 0xfff4d6,
  tail: 0xd8261c,
};

function material(color, { roughness = 0.55, metalness = 0.1 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// Extrude a side profile, given as [length, height] points with the front of
// the car at +length, across the car's width. The result is centred on X with
// the front at -Z.
function sideProfile(points, width, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) {
    shape.lineTo(x, y);
  }
  shape.closePath();

  const bevel = Math.min(0.12, width * 0.05);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, -(width - 2 * bevel) / 2);
  // shape X (along the car, front at +X) becomes -Z
  geometry.rotateY(Math.PI / 2);
  return new THREE.Mesh(geometry, mat);
}

function wheel(x, z, mats) {
  const group = new THREE.Group();

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 32), mats.tyre);
  tyre.rotation.z = Math.PI / 2;
  group.add(tyre);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.57, 6), mats.rim);
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  group.position.set(x, -0.32, z);
  return group;
}

export function createCarModel() {
  const mats = {
    body: material(COLORS.body, { roughness: 0.4, metalness: 0.2 }),
    chassis: material(COLORS.chassis),
    glass: material(COLORS.glass, { roughness: 0.2, metalness: 0.4 }),
    tyre: material(COLORS.tyre, { roughness: 0.9, metalness: 0 }),
    rim: material(COLORS.rim, { roughness: 0.35, metalness: 0.6 }),
    light: material(COLORS.light, { roughness: 0.3 }),
    tail: material(COLORS.tail, { roughness: 0.3 }),
  };

  // The caller sets the outer group's scale; the parts sit in an inner group
  // sized so the car fills the preview about as much as the old aircraft did.
  const car = new THREE.Group();
  car.name = "car";
  const parts = new THREE.Group();
  parts.scale.setScalar(1.0);
  car.add(parts);

  // Flat chassis plate under everything
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 6.0), mats.chassis);
  chassis.position.set(0, -0.42, 0);
  parts.add(chassis);

  // Body up to the waistline: low nose, fuller rear
  parts.add(
    sideProfile(
      [
        [3.05, -0.33],
        [3.05, 0.0],
        [2.2, 0.28],
        [-2.4, 0.38],
        [-3.0, 0.32],
        [-3.0, -0.33],
      ],
      2.75,
      mats.body,
    ),
  );

  // Cabin (windows) on top
  parts.add(
    sideProfile(
      [
        [1.1, 0.3],
        [0.15, 0.92],
        [-1.25, 0.92],
        [-2.05, 0.36],
      ],
      2.15,
      mats.glass,
    ),
  );

  // Wheels: front axle at -Z
  for (const [x, z] of [
    [-1.5, -1.95],
    [1.5, -1.95],
    [-1.5, 2.0],
    [1.5, 2.0],
  ]) {
    parts.add(wheel(x, z, mats));
  }

  // Rear wing on two struts
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.07, 0.6), mats.chassis);
  wing.position.set(0, 0.9, 2.75);
  parts.add(wing);
  for (const x of [-0.75, 0.75]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.28), mats.chassis);
    strut.position.set(x, 0.62, 2.75);
    parts.add(strut);
  }

  // Headlights at the front, tail lights at the back, so heading reads at a glance
  for (const x of [-0.9, 0.9]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.08), mats.light);
    head.position.set(x, 0.02, -3.2);
    parts.add(head);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.08), mats.tail);
    tail.position.set(x, 0.2, 3.15);
    parts.add(tail);
  }

  return car;
}
