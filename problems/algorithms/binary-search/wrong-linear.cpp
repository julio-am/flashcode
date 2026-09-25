int binarySearch(const std::vector<int>& nums, int target) {
  for (int i = 0; i < static_cast<int>(nums.size()); ++i)
    if (nums[i] == target) return i;
  return -1;
}
