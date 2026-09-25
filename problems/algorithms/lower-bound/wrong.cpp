int lowerBound(const std::vector<int>& nums, int target) {
  int lo = 0, hi = static_cast<int>(nums.size());
  while (lo < hi) {
    int mid = lo + (hi - lo) / 2;
    if (nums[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
