int main() {
  std::vector<std::pair<std::vector<int>, int>> cases{
      {{1, 2, 3, 2, 4, 2}, 2}, {{5, 5, 5}, 5}, {{1, 2, 3}, 9}};
  for (auto [v, x] : cases) {
    std::vector<int> want;
    for (int e : v) if (e != x) want.push_back(e);
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "no copies of x remain and the size shrank");
  }
  FLASH_DONE();
}
