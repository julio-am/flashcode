struct User {
  int age = 0;
  std::pair<std::string, std::string> name;
  bool operator<(const User& other) const { return name < other.name; }
};
