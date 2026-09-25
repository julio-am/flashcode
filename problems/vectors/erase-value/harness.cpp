int main() {
  std::vector<std::pair<std::vector<int>, int>> cases{
      {{1, 2, 3, 2, 4, 2}, 2}, {{5, 5, 5}, 5}, {{1, 2, 3}, 9}};
  for (auto [v, x] : cases) {
    FLASH_CASE("v", v, "x", x);
    std::vector<int> want;
    for (int e : v) if (e != x) want.push_back(e);
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "no copies of x should remain, and v.size() should shrink");
  }
  FLASH_DONE();
}
