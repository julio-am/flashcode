// @USER_CODE

int main() {
  std::vector<std::pair<std::vector<std::vector<int>>, int>> cases{
      {{{0, 0, 0}, {0, 0, 0}, {0, 0, 0}}, 4},
      {{{0, 1, 0, 0}, {0, 1, 0, 1}, {0, 0, 0, 0}}, 5},
      {{{0, 1}, {1, 0}}, -1},
      {{{0}}, 0},
      {{{1, 0}, {0, 0}}, -1},
      {{{0, 0, 0, 0}, {0, 1, 1, 0}, {0, 0, 0, 0}, {1, 1, 1, 0}}, 6}};
  for (const auto& [grid, want] : cases) {
    FLASH_CASE("grid", grid);
    CHECK_EQ(shortestPath(grid), want, want == -1 ? "should return -1 when the corner can't be reached"
                                                  : "should return the fewest steps (BFS, not DFS)");
  }
  {
    FLASH_CASE("grid", "400 x 400, all open");
    std::vector<std::vector<int>> open(400, std::vector<int>(400, 0));
    CHECK_EQ(shortestPath(open), 798, "should handle a large grid quickly");
  }
  FLASH_DONE();
}
