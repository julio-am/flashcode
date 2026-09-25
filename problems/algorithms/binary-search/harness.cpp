// @USER_CODE

int main() {
  std::vector<int> nums{-9, -3, 0, 4, 7, 12, 25};
  bool ok = true;
  for (int i = 0; i < static_cast<int>(nums.size()); ++i) ok = ok && binarySearch(nums, nums[i]) == i;
  CHECK(ok, "finds every element, including the first and last");
  CHECK_EQ(binarySearch(nums, 5), -1, "returns -1 for a missing value in the middle");
  CHECK_EQ(binarySearch(nums, -100), -1, "returns -1 below the smallest value");
  CHECK_EQ(binarySearch(nums, 100), -1, "returns -1 above the largest value");
  CHECK_EQ(binarySearch({}, 3), -1, "returns -1 for an empty vector");
  CHECK_EQ(binarySearch({42}, 42), 0, "finds the only element of a one-element vector");

  // A linear scan here takes minutes and hits the time limit.
  std::vector<int> big(1'000'000);
  for (int i = 0; i < static_cast<int>(big.size()); ++i) big[i] = 2 * i;
  bool fast_ok = true;
  for (int q = 0; q < 200'000; ++q) {
    int i = static_cast<int>((q * 7919LL) % big.size());
    fast_ok = fast_ok && binarySearch(big, big[i]) == i && binarySearch(big, big[i] + 1) == -1;
  }
  CHECK(fast_ok, "correct on 400,000 lookups in a million-element vector");
  FLASH_DONE();
}
