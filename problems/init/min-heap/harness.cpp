int main() {
  // @USER_CODE
  CHECK_EQ(pq.size(), std::size_t{0}, "pq should start empty");
  {
    FLASH_CASE("push", "5, 1, 8, 3, 9, 2");
    for (int x : {5, 1, 8, 3, 9, 2}) pq.push(x);
    std::vector<int> pop_order;
    while (!pq.empty()) { pop_order.push_back(pq.top()); pq.pop(); }
    CHECK_EQ(pop_order, (std::vector<int>{1, 2, 3, 5, 8, 9}), "top() should always be the smallest element");
  }
  FLASH_DONE();
}
