int shortestPath(const std::vector<std::vector<int>>& grid) {
  int n = grid.size(), m = grid[0].size();
  if (grid[0][0] || grid[n - 1][m - 1]) return -1;
  std::vector<std::vector<int>> dist(n, std::vector<int>(m, -1));
  std::queue<std::pair<int, int>> q;
  q.push({0, 0});
  dist[0][0] = 0;
  int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
  while (!q.empty()) {
    auto [r, c] = q.front();
    q.pop();
    for (int k = 0; k < 4; ++k) {
      int nr = r + dr[k], nc = c + dc[k];
      if (nr < 0 || nc < 0 || nr >= n || nc >= m || grid[nr][nc] || dist[nr][nc] != -1) continue;
      dist[nr][nc] = dist[r][c] + 1;
      q.push({nr, nc});
    }
  }
  return dist[n - 1][m - 1];
}
