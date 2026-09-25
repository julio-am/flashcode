// @USER_CODE

template <class U, class = void> struct flash_has_age : std::false_type {};
template <class U> struct flash_has_age<U, std::void_t<decltype(std::declval<U&>().age)>> : std::true_type {};
template <class U, class = void> struct flash_has_name : std::false_type {};
template <class U> struct flash_has_name<U, std::void_t<decltype(std::declval<U&>().name)>> : std::true_type {};
template <class U, class = void> struct flash_has_less : std::false_type {};
template <class U> struct flash_has_less<U, std::void_t<decltype(std::declval<U&>() < std::declval<U&>())>> : std::true_type {};

template <class U>
void flash_run() {
  if constexpr (!std::is_constructible_v<U, int, std::string, std::string>) {
    FAIL("User(int age, std::string first, std::string last) constructor exists");
  } else if constexpr (!flash_has_age<U>::value) {
    FAIL("User has a public member named age");
  } else if constexpr (!flash_has_name<U>::value) {
    FAIL("User has a public member named name");
  } else if constexpr (!flash_has_less<U>::value) {
    FAIL("User has an operator< that compares two Users");
  } else {
    CHECK((std::is_same_v<std::decay_t<decltype(std::declval<U&>().age)>, int>), "age is an int");
    CHECK((std::is_same_v<std::decay_t<decltype(std::declval<U&>().name)>,
                          std::pair<std::string, std::string>>),
          "name is a std::pair<std::string, std::string>");
    U ada(36, "Ada", "Lovelace");
    CHECK_EQ(ada.age, 36, "the constructor sets age");
    CHECK_EQ(ada.name, (std::pair<std::string, std::string>{"Ada", "Lovelace"}),
             "the constructor sets name to (first, last)");
    std::vector<U> users{U(30, "Zed", "Adams"), U(25, "Amy", "Young"), U(40, "Amy", "Baker"),
                         U(20, "Bob", "Smith")};
    std::sort(users.begin(), users.end());
    std::vector<std::string> order;
    for (auto& u : users) order.push_back(u.name.first + " " + u.name.second);
    CHECK_EQ(order, (std::vector<std::string>{"Amy Baker", "Amy Young", "Bob Smith", "Zed Adams"}),
             "sorting orders users alphabetically by name");
  }
}

int main() {
  flash_run<User>();
  FLASH_DONE();
}
