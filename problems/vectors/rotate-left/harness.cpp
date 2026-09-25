int main() {
  std::vector<std::pair<std::vector<int>, int>> cases{
      {{1, 2, 3, 4, 5}, 2}, {{1, 2, 3}, 0}, {{1, 2, 3}, 3}, {{6, 7, 8, 9}, 1}};
  for (auto [v, k] : cases) {
    FLASH_CASE("v", v, "k", k);
    std::vector<int> want(v.begin() + k, v.end());
    want.insert(want.end(), v.begin(), v.begin() + k);
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "v should be rotated left by k");
  }
  FLASH_DONE();
}
