int main() {
  std::vector<std::vector<int>> cases{{1, 2, 3, 4, 5}, {8, 9}, {}, {4, 3, 2, 1, 0, -1}};
  for (auto v : cases) {
    FLASH_CASE("v", v);
    const auto orig = v;
    const std::size_t half = orig.size() / 2;
    // @USER_CODE
    CHECK_EQ(left, (std::vector<int>(orig.begin(), orig.begin() + half)), "left should be the first v.size() / 2 elements");
    CHECK_EQ(right, (std::vector<int>(orig.begin() + half, orig.end())), "right should be the rest");
  }
  FLASH_DONE();
}
