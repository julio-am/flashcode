// @USER_CODE

int main() {
  std::vector<std::pair<std::vector<std::string>, int>> cases{
      {{"11110", "11010", "11000", "00000"}, 1},
      {{"11000", "11000", "00100", "00011"}, 3},
      {{"101", "010", "101"}, 5},
      {{"000", "000"}, 0},
      {{"1"}, 1},
      {{}, 0},
      {{"11111", "00001", "11111", "10000", "11111"}, 1}};
  for (const auto& [rows, want] : cases) {
    FLASH_CASE("grid", rows);
    std::vector<std::vector<char>> grid;
    for (const auto& r : rows) grid.emplace_back(r.begin(), r.end());
    CHECK_EQ(numIslands(grid), want, "should count islands connected up, down, left and right only");
  }
  FLASH_DONE();
}
