export const RECIPES = [
  { grid: [[7, 0], [0, 0]], result: { type: 9, count: 4 }, name: 'Oak Planks' },
  { grid: [[18, 0], [0, 0]], result: { type: 21, count: 4 }, name: 'Spruce Planks' },
  { grid: [[20, 0], [0, 0]], result: { type: 24, count: 4 }, name: 'Birch Planks' },
  { grid: [[9, 9], [0, 0]], result: { type: 31, count: 4 }, name: 'Stone Bricks' },
  { grid: [[3, 3], [0, 0]], result: { type: 31, count: 4 }, name: 'Stone Bricks' },
  { grid: [[4, 0], [0, 0]], result: { type: 31, count: 4 }, name: 'Stone Bricks' },
  { grid: [[5, 5], [0, 0]], result: { type: 16, count: 4 }, name: 'Sandstone' },
  { grid: [[9, 9], [9, 9]], result: { type: 17, count: 4 }, name: 'Brick' },
  { grid: [[17, 17], [17, 17]], result: { type: 17, count: 4 }, name: 'Brick' },
  { grid: [[2, 0], [0, 0]], result: { type: 37, count: 4 }, name: 'Coarse Dirt' },
  { grid: [[37, 0], [0, 0]], result: { type: 2, count: 4 }, name: 'Dirt' },
  { grid: [[11, 11], [11, 11]], result: { type: 43, count: 1 }, name: 'Iron Block' },
  { grid: [[12, 12], [12, 12]], result: { type: 42, count: 1 }, name: 'Gold Block' },
  { grid: [[13, 13], [13, 13]], result: { type: 44, count: 1 }, name: 'Diamond Block' },
  { grid: [[29, 29], [29, 29]], result: { type: 28, count: 4 }, name: 'Packed Mud' },
  { grid: [[28, 28], [0, 0]], result: { type: 30, count: 4 }, name: 'Mud Bricks' },
];

export function checkRecipe(grid) {
  const gridStr = JSON.stringify(grid);
  for (const recipe of RECIPES) {
    if (JSON.stringify(recipe.grid) === gridStr) return recipe.result;
  }
  return null;
}
