int main() {
  std::vector<std::pair<std::vector<int>, std::vector<int>>> cases{
      {{1, 2, 3}, {4, 5, 6}}, {{}, {7, 8}}, {{9}, {}}};
  for (auto [a, b] : cases) {
    FLASH_CASE("a", a, "b", b);
    auto want = b;
    want.insert(want.end(), a.begin(), a.end());
    const auto orig_a = a;
    {
      // @USER_CODE
    }
    CHECK_EQ(b, want, "b should end with the elements of a");
    CHECK_EQ(a, orig_a, "a should be unchanged");
  }
  FLASH_DONE();
}
