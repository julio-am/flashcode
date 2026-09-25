int main() {
  std::vector<std::pair<std::vector<int>, std::vector<int>>> cases{
      {{10, 20, 30, 40}, {1}}, {{5, 6, 7}, {}}};
  for (auto [src, dst] : cases) {
    FLASH_CASE("src", src, "dst", dst);
    auto want_dst = dst;
    want_dst.insert(want_dst.end(), src.begin() + 1, src.begin() + 3);
    auto want_src = src;
    want_src.erase(want_src.begin() + 1, want_src.begin() + 3);
    {
      // @USER_CODE
    }
    CHECK_EQ(dst, want_dst, "dst should gain src[1] and src[2] at the end");
    CHECK_EQ(src, want_src, "src should no longer hold them");
  }
  FLASH_DONE();
}
