int main() {
  std::vector<std::vector<int>> cases{{10, 20, 30, 40, 50, 60, 70}, {1, 2, 3, 4, 5}};
  for (auto v : cases) {
    const auto orig = v;
    // @USER_CODE
    CHECK_EQ(sub, (std::vector<int>(orig.begin() + 2, orig.begin() + 5)), "sub holds v[2], v[3], v[4]");
    CHECK_EQ(v, orig, "v is unchanged");
  }
  FLASH_DONE();
}
