int main() {
  std::vector<std::pair<std::vector<int>, std::vector<int>>> cases{
      {{1, 2, 5, 6}, {3, 4}}, {{0, 0}, {7}}, {{9, 9, 9}, {}}};
  for (auto [v, mid] : cases) {
    auto want = v;
    want.insert(want.begin() + 2, mid.begin(), mid.end());
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "mid starts at index 2 of v");
  }
  FLASH_DONE();
}
