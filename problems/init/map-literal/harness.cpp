int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(ages)>, std::unordered_map<std::string, int>>,
                "ages should be a std::unordered_map<std::string, int>");
  CHECK_EQ(ages.size(), std::size_t{2}, "ages has 2 entries");
  CHECK(ages.count("ann") && ages.at("ann") == 31, "ann maps to 31");
  CHECK(ages.count("bob") && ages.at("bob") == 27, "bob maps to 27");
  FLASH_DONE();
}
