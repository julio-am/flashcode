// @USER_CODE

int main() {
  const std::vector<int> nums{1, 3, 3, 3, 5, 8};
  std::vector<std::tuple<std::vector<int>, int, int>> cases{
      {nums, 3, 1}, {nums, 4, 4}, {nums, 0, 0}, {nums, 9, 6}, {{}, 1, 0}};
  for (const auto& [v, target, want] : cases) {
    FLASH_CASE("nums", v, "target", target);
    CHECK_EQ(lowerBound(v, target), want, "should return the first index i with nums[i] >= target, or nums.size()");
  }
  {
    FLASH_CASE("nums", "each of 0, 1, 2, … repeated 3 times (500,000 elements)", "targets", "-1 to 199,999");
    std::vector<int> big(500'000);
    for (int i = 0; i < static_cast<int>(big.size()); ++i) big[i] = i / 3;
    int wrong = 0;
    for (int t = -1; t < 200'000; ++t)
      wrong += lowerBound(big, t) != static_cast<int>(std::lower_bound(big.begin(), big.end(), t) - big.begin());
    CHECK_OUT("wrong answers", wrong, 0, "should match std::lower_bound on every query");
  }
  FLASH_DONE();
}
