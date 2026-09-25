int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(ages)>, std::unordered_map<std::string, int>>,
                "ages should be a std::unordered_map<std::string, int>");
  CHECK_OUT("ages (sorted by key)", (std::map<std::string, int>(ages.begin(), ages.end())),
            (std::map<std::string, int>{{"ann", 31}, {"bob", 27}}),
            "ages should map \"ann\" to 31 and \"bob\" to 27, and nothing else");
  FLASH_DONE();
}
