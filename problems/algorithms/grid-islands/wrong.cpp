void dfs(std::vector<std::vector<char>>& grid, int r, int c) {
  if (r < 0 || c < 0 || r >= (int)grid.size() || c >= (int)grid[0].size() || grid[r][c] != '1') return;
  grid[r][c] = '0';
  for (int dr = -1; dr <= 1; ++dr)
    for (int dc = -1; dc <= 1; ++dc)
      if (dr || dc) dfs(grid, r + dr, c + dc);
}

int numIslands(std::vector<std::vector<char>>& grid) {
  int count = 0;
  for (int r = 0; r < (int)grid.size(); ++r)
    for (int c = 0; c < (int)grid[r].size(); ++c)
      if (grid[r][c] == '1') { ++count; dfs(grid, r, c); }
  return count;
}
