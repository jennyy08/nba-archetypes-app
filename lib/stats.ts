/**
 * Client-side reimplementation of the stats pipeline that used to live
 * only in Python (scikit-learn). This is what makes "live re-clustering"
 * possible: instead of calling a backend every time the user changes
 * the number of clusters or which stats to use, we recompute everything
 * instantly in the browser. With ~400 players and a handful of features,
 * this runs in single-digit milliseconds - no need for a server at all.
 */

export type PlayerRecord = Record<string, number | string> & { name: string; team: string };

export type ArchetypeResult = {
  archetypeId: string;
  score: number;
};

/** Standardize each column to mean=0, std=1 (same role as sklearn's StandardScaler). */
export function standardize(matrix: number[][]): number[][] {
  const nRows = matrix.length;
  const nCols = matrix[0].length;
  const means = new Array(nCols).fill(0);
  const stds = new Array(nCols).fill(0);

  for (let c = 0; c < nCols; c++) {
    let sum = 0;
    for (let r = 0; r < nRows; r++) sum += matrix[r][c];
    means[c] = sum / nRows;
  }
  for (let c = 0; c < nCols; c++) {
    let sumSq = 0;
    for (let r = 0; r < nRows; r++) sumSq += (matrix[r][c] - means[c]) ** 2;
    stds[c] = Math.sqrt(sumSq / nRows) || 1; // avoid divide-by-zero on constant columns
  }

  return matrix.map((row) => row.map((v, c) => (v - means[c]) / stds[c]));
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * K-means clustering (Lloyd's algorithm), same core idea as
 * sklearn.cluster.KMeans: initialize k random centers, repeatedly
 * assign each point to its nearest center and move centers to the
 * mean of their assigned points, until assignments stop changing.
 */
export function kMeans(data: number[][], k: number, maxIterations = 100, seed = 42): number[] {
  const n = data.length;
  const dims = data[0].length;

  // Simple seeded PRNG so results are reproducible across renders,
  // instead of a different random clustering every time the component re-runs.
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // k-means++ style seeding: pick the first center randomly, then each
  // subsequent center is chosen with probability proportional to its
  // squared distance from the nearest existing center. This spreads
  // initial centers out, which converges faster and more reliably than
  // picking k random points.
  const centers: number[][] = [];
  centers.push(data[Math.floor(rand() * n)]);
  while (centers.length < k) {
    const distances = data.map((point) =>
      Math.min(...centers.map((c) => euclideanDistance(point, c) ** 2))
    );
    const total = distances.reduce((a, b) => a + b, 0);
    let threshold = rand() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      threshold -= distances[i];
      if (threshold <= 0) {
        chosen = i;
        break;
      }
    }
    centers.push(data[chosen]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    const newAssignments = data.map((point) => {
      let best = 0;
      let bestDist = Infinity;
      centers.forEach((center, ci) => {
        const d = euclideanDistance(point, center);
        if (d < bestDist) {
          bestDist = d;
          best = ci;
        }
      });
      return best;
    });

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;
    if (!changed && iter > 0) break;

    // Recompute each center as the mean of its assigned points.
    for (let ci = 0; ci < k; ci++) {
      const members = data.filter((_, i) => assignments[i] === ci);
      if (members.length === 0) continue; // keep old center if a cluster went empty
      const newCenter = new Array(dims).fill(0);
      members.forEach((m) => m.forEach((v, d) => (newCenter[d] += v)));
      centers[ci] = newCenter.map((v) => v / members.length);
    }
  }

  return assignments;
}

/**
 * PCA via power iteration on the covariance matrix - a lightweight way
 * to find the top 2 principal components without needing a full linear
 * algebra library. Good enough for our purposes (dozens of features,
 * hundreds of rows); a real numerical library would use SVD instead.
 */
export function pca2D(data: number[][]): { coords: [number, number][]; varianceExplained: number } {
  const n = data.length;
  const dims = data[0].length;

  // Covariance matrix (data is already standardized, so this is
  // essentially the correlation matrix).
  const cov: number[][] = Array.from({ length: dims }, () => new Array(dims).fill(0));
  for (let i = 0; i < dims; i++) {
    for (let j = 0; j < dims; j++) {
      let sum = 0;
      for (let r = 0; r < n; r++) sum += data[r][i] * data[r][j];
      cov[i][j] = sum / (n - 1);
    }
  }

  function powerIteration(matrix: number[][], excludeVector?: number[], seed = 42): { vector: number[]; value: number } {
    let state = seed;
    const random = () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
    let vec = new Array(dims).fill(0).map(() => random());
    for (let iter = 0; iter < 200; iter++) {
      let next = matrix.map((row) => row.reduce((sum, v, i) => sum + v * vec[i], 0));
      if (excludeVector) {
        const dot = next.reduce((s, v, i) => s + v * excludeVector[i], 0);
        next = next.map((v, i) => v - dot * excludeVector[i]);
      }
      const norm = Math.sqrt(next.reduce((s, v) => s + v * v, 0)) || 1;
      vec = next.map((v) => v / norm);
    }
    const Av = matrix.map((row) => row.reduce((sum, v, i) => sum + v * vec[i], 0));
    const value = vec.reduce((s, v, i) => s + v * Av[i], 0);
    return { vector: vec, value };
  }

  const pc1 = powerIteration(cov);
  const pc2 = powerIteration(cov, pc1.vector, 99);

  const totalVariance = cov.reduce((sum, row, i) => sum + row[i], 0);
  const varianceExplained = (pc1.value + pc2.value) / totalVariance;

  const coords: [number, number][] = data.map((row) => [
    row.reduce((s, v, i) => s + v * pc1.vector[i], 0),
    row.reduce((s, v, i) => s + v * pc2.vector[i], 0),
  ]);

  return { coords, varianceExplained };
}

/** Nearest-neighbor lookup: given one player's row index, rank all others by distance. */
export function nearestNeighbors(data: number[][], targetIndex: number, topN = 5): { index: number; distance: number }[] {
  const target = data[targetIndex];
  const distances = data.map((row, i) => ({ index: i, distance: euclideanDistance(row, target) }));
  return distances
    .filter((d) => d.index !== targetIndex)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topN);
}

/**
 * Score intentional archetype definitions against standardized season data.
 * A score is a percentile (0–100) within this data set, rather than a claim
 * that a player is a literal percentage match for a role.
 */
export function scoreArchetypes(
  players: PlayerRecord[],
  features: string[],
  archetypes: { id: string; weights: Record<string, number> }[]
): ArchetypeResult[][] {
  const scaled = standardize(players.map((player) => features.map((feature) => Number(player[feature]))));
  const featureIndex = new Map(features.map((feature, index) => [feature, index]));
  const rawByArchetype = archetypes.map((archetype) =>
    scaled.map((row) =>
      Object.entries(archetype.weights).reduce((total, [feature, weight]) => {
        const index = featureIndex.get(feature);
        return total + (index === undefined ? 0 : row[index] * weight);
      }, 0)
    )
  );

  return players.map((_, playerIndex) =>
    archetypes
      .map((archetype, archetypeIndex) => {
        const raw = rawByArchetype[archetypeIndex];
        const rank = raw.filter((value) => value <= raw[playerIndex]).length;
        return { archetypeId: archetype.id, score: Math.round((rank / raw.length) * 100) };
      })
      .sort((a, b) => b.score - a.score)
  );
}
