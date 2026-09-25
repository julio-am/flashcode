int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(dirs)>, std::vector<std::pair<int, int>>>,
                "dirs should be a std::vector<std::pair<int, int>>");
  CHECK_OUT("dirs (sorted)", (std::multiset<std::pair<int, int>>(dirs.begin(), dirs.end())),
            (std::multiset<std::pair<int, int>>{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}),
            "dirs should be exactly up, down, left and right, in any order");
  FLASH_DONE();
}
