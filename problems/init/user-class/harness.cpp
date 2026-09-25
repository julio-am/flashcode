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
    FAIL("User needs a constructor User(int age, std::string first, std::string last)");
  } else if constexpr (!flash_has_age<U>::value) {
    FAIL("User needs a public member named age");
  } else if constexpr (!flash_has_name<U>::value) {
    FAIL("User needs a public member named name");
  } else if constexpr (!flash_has_less<U>::value) {
    FAIL("User needs an operator< that compares two Users");
  } else {
    {
      FLASH_CASE("construct", "User(36, \"Ada\", \"Lovelace\")");
      U ada(36, "Ada", "Lovelace");
      CHECK((std::is_same_v<std::decay_t<decltype(ada.age)>, int>), "age should be an int");
      CHECK((std::is_same_v<std::decay_t<decltype(ada.name)>, std::pair<std::string, std::string>>),
            "name should be a std::pair<std::string, std::string>");
      CHECK_OUT("age", ada.age, 36, "the constructor should set age");
      CHECK_OUT("name", ada.name, (std::pair<std::string, std::string>{"Ada", "Lovelace"}),
                "the constructor should set name to (first, last)");
    }
    {
      FLASH_CASE("sort", "User(30, \"Zed\", \"Adams\"), User(25, \"Amy\", \"Young\"), User(40, \"Amy\", \"Baker\"), User(20, \"Bob\", \"Smith\")");
      std::vector<U> users{U(30, "Zed", "Adams"), U(25, "Amy", "Young"), U(40, "Amy", "Baker"), U(20, "Bob", "Smith")};
      std::sort(users.begin(), users.end());
      std::vector<std::pair<std::string, std::string>> names;
      for (auto& u : users) names.push_back(u.name);
      CHECK_OUT("names after std::sort", names,
                (std::vector<std::pair<std::string, std::string>>{
                    {"Amy", "Baker"}, {"Amy", "Young"}, {"Bob", "Smith"}, {"Zed", "Adams"}}),
                "operator< should order users alphabetically by name (first, then last)");
    }
  }
}

int main() {
  flash_run<User>();
  FLASH_DONE();
}
