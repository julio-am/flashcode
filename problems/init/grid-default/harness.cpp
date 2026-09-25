int main() {
  std::vector<std::pair<int, int>> cases{{3, 4}, {1, 1}, {5, 2}};
  for (auto [rows, cols] : cases) {
    // @USER_CODE
    static_assert(std::is_same_v<std::decay_t<decltype(grid)>, std::vector<std::vector<int>>>,
                  "grid should be a std::vector<std::vector<int>>");
    CHECK_EQ(grid.size(), static_cast<std::size_t>(rows), "grid has rows rows");
    bool ok = true;
    for (const auto& row : grid) ok = ok && row == std::vector<int>(cols, -1);
    CHECK(ok, "every row has cols cells set to -1");
  }
  FLASH_DONE();
}
