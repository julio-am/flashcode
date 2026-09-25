int main() {
  std::vector<std::pair<int, int>> cases{{3, 4}, {1, 1}, {5, 2}};
  for (auto [rows, cols] : cases) {
    FLASH_CASE("rows", rows, "cols", cols);
    // @USER_CODE
    static_assert(std::is_same_v<std::decay_t<decltype(grid)>, std::vector<std::vector<int>>>,
                  "grid should be a std::vector<std::vector<int>>");
    CHECK_EQ(grid, (std::vector<std::vector<int>>(rows, std::vector<int>(cols, -1))),
             "grid should have rows rows of cols cells, every cell -1");
  }
  FLASH_DONE();
}
