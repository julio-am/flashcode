int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(v)>, std::vector<std::vector<int>>>,
                "v should be a std::vector<std::vector<int>>");
  CHECK_EQ(v.size(), std::size_t{5}, "v holds 5 inner vectors");
  bool ok = true;
  for (const auto& inner : v) ok = ok && inner == std::vector<int>{5};
  CHECK(ok, "every inner vector is {5}");
  FLASH_DONE();
}
