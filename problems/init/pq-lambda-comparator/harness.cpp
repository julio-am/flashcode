int main() {
  // @USER_CODE
  CHECK_EQ(pq.size(), std::size_t{0}, "pq should start empty");
  {
    FLASH_CASE("push", "(3, \"write\"), (1, \"plan\"), (4, \"ship\"), (2, \"build\")");
    pq.push({3, "write"});
    pq.push({1, "plan"});
    pq.push({4, "ship"});
    pq.push({2, "build"});
    std::vector<std::string> pop_order;
    while (!pq.empty()) { pop_order.push_back(pq.top().second); pq.pop(); }
    CHECK_EQ(pop_order, (std::vector<std::string>{"plan", "build", "write", "ship"}),
             "top() should be the pair with the smallest priority");
  }
  FLASH_DONE();
}
