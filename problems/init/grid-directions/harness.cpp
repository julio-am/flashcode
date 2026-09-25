int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(dirs)>, std::vector<std::pair<int, int>>>,
                "dirs should be a std::vector<std::pair<int, int>>");
  CHECK_EQ(dirs.size(), std::size_t{4}, "dirs has 4 entries");
  std::set<std::pair<int, int>> got(dirs.begin(), dirs.end());
  std::set<std::pair<int, int>> want{{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
  CHECK_EQ(got, want, "dirs is up, down, left and right");
  FLASH_DONE();
}
