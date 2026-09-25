// @USER_CODE

int main() {
  struct Case { std::string label; std::vector<std::vector<int>> grid; int want; };
  std::vector<Case> cases{
      {"an open 3x3 grid", {{0, 0, 0}, {0, 0, 0}, {0, 0, 0}}, 4},
      {"a grid that forces a detour", {{0, 1, 0, 0}, {0, 1, 0, 1}, {0, 0, 0, 0}}, 5},
      {"a blocked grid", {{0, 1}, {1, 0}}, -1},
      {"a single open cell", {{0}}, 0},
      {"a walled-off start", {{1, 0}, {0, 0}}, -1},
      {"a grid where DFS finds a longer path first",
       {{0, 0, 0, 0}, {0, 1, 1, 0}, {0, 0, 0, 0}, {1, 1, 1, 0}}, 6}};
  for (const auto& c : cases) CHECK_EQ(shortestPath(c.grid), c.want, "handles " + c.label);
  std::vector<std::vector<int>> open(400, std::vector<int>(400, 0));
  CHECK_EQ(shortestPath(open), 798, "handles a 400x400 open grid quickly");
  FLASH_DONE();
}
