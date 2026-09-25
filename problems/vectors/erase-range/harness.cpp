int main() {
  std::vector<std::vector<int>> cases{{0, 1, 2, 3, 4, 5}, {9, 8, 7, 6}};
  for (auto v : cases) {
    FLASH_CASE("v", v);
    auto want = v;
    want.erase(want.begin() + 1, want.begin() + 4);
    {
      // @USER_CODE
    }
    CHECK_EQ(v, want, "indices 1 to 3 should be gone");
  }
  FLASH_DONE();
}
