// @USER_CODE

std::vector<std::vector<char>> flash_grid(const std::vector<std::string>& rows) {
  std::vector<std::vector<char>> g;
  for (const auto& r : rows) g.emplace_back(r.begin(), r.end());
  return g;
}

int main() {
  struct Case { std::string label; std::vector<std::string> rows; int want; };
  std::vector<Case> cases{
      {"one big island", {"11110", "11010", "11000", "00000"}, 1},
      {"three islands", {"11000", "11000", "00100", "00011"}, 3},
      {"diagonal cells are separate islands", {"101", "010", "101"}, 5},
      {"all water", {"000", "000"}, 0},
      {"a single land cell", {"1"}, 1},
      {"an empty grid", {}, 0},
      {"a winding island", {"11111", "00001", "11111", "10000", "11111"}, 1}};
  for (const auto& c : cases) {
    auto g = flash_grid(c.rows);
    CHECK_EQ(numIslands(g), c.want, "counts " + c.label);
  }
  FLASH_DONE();
}
