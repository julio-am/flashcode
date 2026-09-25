int main() {
  std::vector<std::vector<int>> cases{{3, 1, 3, 2, 1}, {7, 7, 7}, {}, {5, -1, 5, 0}};
  for (auto v : cases) {
    FLASH_CASE("v", v);
    std::set<int> s(v.begin(), v.end());
    std::vector<int> want(s.begin(), s.end());
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "v should be sorted with no duplicates");
  }
  FLASH_DONE();
}
