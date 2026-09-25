auto cmp = [](const std::pair<int, std::string>& a, const std::pair<int, std::string>& b) {
  return a.first > b.first;
};
std::priority_queue<std::pair<int, std::string>, std::vector<std::pair<int, std::string>>,
                    decltype(cmp)> pq(cmp);
