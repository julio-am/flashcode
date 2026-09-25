// @USER_CODE

int main() {
  const std::vector<int> nums{-9, -3, 0, 4, 7, 12, 25};
  std::vector<std::tuple<std::vector<int>, int, int>> cases{
      {nums, -9, 0}, {nums, 4, 3}, {nums, 25, 6}, {nums, 5, -1}, {nums, -100, -1},
      {nums, 100, -1}, {{}, 3, -1}, {{42}, 42, 0}};
  for (const auto& [v, target, want] : cases) {
    FLASH_CASE("nums", v, "target", target);
    CHECK_EQ(binarySearch(v, target), want, want == -1 ? "should return -1 when target is missing"
                                                       : "should return the index of target");
  }
  {
    // A linear scan here takes minutes and hits the time limit.
    FLASH_CASE("nums", "0, 2, 4, …, 1999998 (1,000,000 elements)", "targets", "400,000 lookups, half of them missing");
    std::vector<int> big(1'000'000);
    for (int i = 0; i < static_cast<int>(big.size()); ++i) big[i] = 2 * i;
    int wrong = 0;
    for (int q = 0; q < 200'000; ++q) {
      int i = static_cast<int>((q * 7919LL) % big.size());
      wrong += binarySearch(big, big[i]) != i;
      wrong += binarySearch(big, big[i] + 1) != -1;
    }
    CHECK_OUT("wrong answers", wrong, 0, "should be correct and O(log n) on a large input");
  }
  FLASH_DONE();
}
