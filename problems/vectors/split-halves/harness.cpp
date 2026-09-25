int main() {
  std::vector<std::vector<int>> cases{{1, 2, 3, 4, 5}, {8, 9}, {}, {4, 3, 2, 1, 0, -1}};
  for (auto v : cases) {
    const auto orig = v;
    const std::size_t half = orig.size() / 2;
    // @USER_CODE
    CHECK_EQ(left, (std::vector<int>(orig.begin(), orig.begin() + half)), "left is the first half");
    CHECK_EQ(right, (std::vector<int>(orig.begin() + half, orig.end())), "right is the rest");
  }
  FLASH_DONE();
}
