int main() {
  // @USER_CODE
  CHECK_OUT("iteration order", (std::vector<int>(s.begin(), s.end())), (std::vector<int>{3, 2, 1}),
            "s should iterate from largest to smallest");
  {
    FLASH_CASE("insert", "10, 0");
    s.insert(10);
    s.insert(0);
    CHECK_OUT("iteration order", (std::vector<int>(s.begin(), s.end())), (std::vector<int>{10, 3, 2, 1, 0}),
              "s should stay largest first after inserts");
  }
  FLASH_DONE();
}
