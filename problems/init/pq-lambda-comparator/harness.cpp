int main() {
  // @USER_CODE
  CHECK(pq.empty(), "pq starts empty");
  pq.push({3, "write"});
  pq.push({1, "plan"});
  pq.push({4, "ship"});
  pq.push({2, "build"});
  std::vector<std::string> order;
  while (!pq.empty()) { order.push_back(pq.top().second); pq.pop(); }
  CHECK_EQ(order, (std::vector<std::string>{"plan", "build", "write", "ship"}),
           "pops the smallest priority first");
  FLASH_DONE();
}
