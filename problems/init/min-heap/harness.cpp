int main() {
  // @USER_CODE
  CHECK(pq.empty(), "pq starts empty");
  for (int x : {5, 1, 8, 3, 9, 2}) pq.push(x);
  std::vector<int> order;
  while (!pq.empty()) { order.push_back(pq.top()); pq.pop(); }
  CHECK_EQ(order, (std::vector<int>{1, 2, 3, 5, 8, 9}), "pops smallest first");
  FLASH_DONE();
}
