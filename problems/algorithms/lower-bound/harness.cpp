// @USER_CODE

int main() {
  std::vector<int> nums{1, 3, 3, 3, 5, 8};
  CHECK_EQ(lowerBound(nums, 3), 1, "returns the first of several equal values");
  CHECK_EQ(lowerBound(nums, 4), 4, "returns the next larger element when target is missing");
  CHECK_EQ(lowerBound(nums, 0), 0, "returns 0 when everything is >= target");
  CHECK_EQ(lowerBound(nums, 9), 6, "returns nums.size() when everything is < target");
  CHECK_EQ(lowerBound({}, 1), 0, "returns 0 for an empty vector");
  std::vector<int> big(500'000);
  for (int i = 0; i < static_cast<int>(big.size()); ++i) big[i] = i / 3;
  bool ok = true;
  for (int t = -1; t < 200'000; ++t)
    ok = ok && lowerBound(big, t) == static_cast<int>(std::lower_bound(big.begin(), big.end(), t) - big.begin());
  CHECK(ok, "matches std::lower_bound on 200,000 queries");
  FLASH_DONE();
}
