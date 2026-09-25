int main() {
  std::vector<std::vector<int>> cases{{0, 1, 2, 3, 4, 5}, {9, 8, 7, 6}};
  for (auto v : cases) {
    auto want = v;
    want.erase(want.begin() + 1, want.begin() + 4);
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "indices 1 to 3 are gone");
  }
  FLASH_DONE();
}
