int main() {
  // @USER_CODE
  static_assert(std::is_same_v<std::decay_t<decltype(v)>, std::vector<std::vector<int>>>,
                "v should be a std::vector<std::vector<int>>");
  CHECK_EQ(v, (std::vector<std::vector<int>>(5, std::vector<int>{5})),
           "v should hold 5 inner vectors, each exactly {5}");
  FLASH_DONE();
}
