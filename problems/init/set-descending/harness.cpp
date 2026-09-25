int main() {
  // @USER_CODE
  std::vector<int> seen(s.begin(), s.end());
  CHECK_EQ(seen, (std::vector<int>{3, 2, 1}), "iterates 3, 2, 1");
  s.insert(10);
  s.insert(0);
  CHECK_EQ(*s.begin(), 10, "stays largest first after inserts");
  FLASH_DONE();
}
