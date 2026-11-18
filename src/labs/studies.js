// Add a study here and its geometry in scene.js to extend the playground.
export const studies = [
  {id: 'kinetic-type', title: 'Kinetic type', category: 'Typography / Motion', description: 'Words become material. A revolving form built from the same four letters, seen from a different angle.', hint: 'Drag to orbit. Scroll or pinch to move closer.', note: 'A moving identity, a title sequence, a sleeve that never sits still.'},
  {id: 'elastic-grid', title: 'Elastic grid', category: 'Surface / Interaction', description: 'A soft geometry of points and connections. Move across the surface and leave a small disturbance.', hint: 'Move across the grid to disturb it. Drag to orbit.', note: 'A tactile canvas for a season index or a living archive.'},
  {id: 'disc-orbit', title: 'Disc orbit', category: 'Objects / Choreography', description: 'Familiar objects, unfamiliar gravity. A small collection of discs finding their own rhythm.', hint: 'Drag to orbit. Scroll or pinch to move closer.', note: 'A different way to browse a collection, one orbit at a time.'},
  {id: 'folded-matter', title: 'Folded matter', category: 'Geometry / Material', description: 'A sheet caught somewhere between paper and sound. Change the intensity to open up its folds.', hint: 'Drag to examine the folds. Try the wireframe view.', note: 'Digital packaging with the weight and irregularity of a physical object.'},
  {id: 'particle-field', title: 'Particle field', category: 'Space / Behaviour', description: 'Hundreds of small pieces, one shifting body. A field that gathers, scatters and responds to your cursor.', hint: 'Move through the field to push the particles. Drag to orbit.', note: 'A spatial identity that feels different with every visit.'},
  {id: 'light-sculpture', title: 'Light sculpture', category: 'Light / Structure', description: 'A continuous line drawn through space. Nested loops turn light into a shape you can almost hold.', hint: 'Drag to look inside. Increase the intensity to twist the form.', note: 'A stage for ambient sets, installations and late-night transmissions.'},
];

export const categories = [
  {id: '3d-animations', title: '3D animations', description: 'Studies in form, motion and three dimensions.'},
  {id: 'experiences', title: 'Experiences', description: 'Spaces, journeys and immersive worlds to get lost in.', empty: 'A home for immersive concepts and new ways to move through ROOM.'},
  {id: 'interactives', title: 'Interactives', description: 'Ideas that come alive through a little participation.', empty: 'A home for playful tools, gestures and experiments that respond to you.'},
  {id: 'audio-experiments', title: 'Audio experiments', description: 'A place to explore sound, listening and everything in between.', empty: 'A home for sound studies, listening concepts and new ways to play.'},
];

export function selectionFromHash(hash) {
  const [category, study] = hash.replace(/^#/, '').split('/');
  // Preserve links shared before the studies were grouped into categories.
  const legacy = studies.find(item => item.id === category);
  if (legacy) return {category: '3d-animations', study: legacy.id};
  if (!categories.some(item => item.id === category)) return null;
  return {category, study: category === '3d-animations' ? (studies.find(item => item.id === study) || studies[0]).id : undefined};
}

export const palettes = [
  {name: 'Cobalt', hex: '#2448c4'},
  {name: 'Ink', hex: '#272b27'},
  {name: 'Vermilion', hex: '#bf3b21'},
];

export const defaults = () => ({speed: 0.6, intensity: 1, color: palettes[0].hex, wireframe: false});
