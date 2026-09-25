class User {
 public:
  int age;
  std::pair<std::string, std::string> name;

  User(int age, std::string first, std::string last)
      : age(age), name(std::move(first), std::move(last)) {}

  bool operator<(const User& other) const { return age < other.age; }
};
