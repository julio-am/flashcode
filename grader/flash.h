// flash.h: the tiny test library every FlashCode harness includes.
//
// Each check prints one line to stdout:
//   @@FLASH <token> {"ok":true,"name":"...","detail":"..."}
// and FLASH_DONE() prints a final line with the number of checks run.
// The token is read from stdin at startup, so output the user prints
// (or fakes) without knowing the token is ignored by the grader.
#pragma once
#include <bits/stdc++.h>

namespace flash_internal {

inline std::string& token() {
  static std::string t;
  return t;
}

inline int& checks_run() {
  static int n = 0;
  return n;
}

struct TokenReader {
  TokenReader() {
    std::getline(std::cin, token());
    std::cout.setf(std::ios::unitbuf);
  }
};
inline TokenReader token_reader;

inline std::string json_escape(const std::string& s) {
  std::string out;
  for (unsigned char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof buf, "\\u%04x", c);
          out += buf;
        } else {
          out += static_cast<char>(c);
        }
    }
  }
  return out;
}

inline void emit(bool ok, const std::string& name, const std::string& detail) {
  ++checks_run();
  std::cout << "\n@@FLASH " << token() << " {\"ok\":" << (ok ? "true" : "false")
            << ",\"name\":\"" << json_escape(name) << "\"";
  if (!detail.empty()) std::cout << ",\"detail\":\"" << json_escape(detail) << "\"";
  std::cout << "}" << std::endl;
}

// show(x): readable rendering of values used in CHECK_EQ failure messages.
template <class T, class = void>
struct is_iterable : std::false_type {};
template <class T>
struct is_iterable<T, std::void_t<decltype(std::begin(std::declval<const T&>())),
                                  decltype(std::end(std::declval<const T&>()))>>
    : std::true_type {};

template <class T>
struct is_pair : std::false_type {};
template <class A, class B>
struct is_pair<std::pair<A, B>> : std::true_type {};

template <class T>
std::string show(const T& v) {
  if constexpr (is_pair<T>::value) {
    return "(" + show(v.first) + ", " + show(v.second) + ")";
  } else if constexpr (std::is_same_v<T, std::string>) {
    return "\"" + v + "\"";
  } else if constexpr (std::is_same_v<T, char>) {
    return std::string("'") + v + "'";
  } else if constexpr (std::is_same_v<T, bool>) {
    return v ? "true" : "false";
  } else if constexpr (std::is_arithmetic_v<T>) {
    std::ostringstream os;
    os << v;
    return os.str();
  } else if constexpr (is_iterable<T>::value) {
    std::string out = "{";
    bool first = true;
    for (const auto& x : v) {
      if (!first) out += ", ";
      first = false;
      out += show(x);
    }
    return out + "}";
  } else {
    return "(value)";
  }
}

}  // namespace flash_internal

// CHECK(condition, "what should be true")
#define CHECK(cond, name) ::flash_internal::emit(static_cast<bool>(cond), (name), "")

// CHECK_EQ(actual, expected, "what should be true"): shows both values on failure.
#define CHECK_EQ(actual, expected, name)                                          \
  do {                                                                            \
    const auto& flash_a_ = (actual);                                              \
    const auto& flash_e_ = (expected);                                            \
    bool flash_ok_ = (flash_a_ == flash_e_);                                      \
    ::flash_internal::emit(flash_ok_, (name),                                     \
                           flash_ok_ ? std::string()                              \
                                     : "expected " + ::flash_internal::show(flash_e_) + \
                                           ", got " + ::flash_internal::show(flash_a_)); \
  } while (0)

// FAIL("why"): a check that always fails, for probes that detect missing pieces.
#define FAIL(name) ::flash_internal::emit(false, (name), "")

// FLASH_DONE(): must be the last thing main() does. No DONE line means the
// program crashed or exited early, which the grader treats as a failure.
#define FLASH_DONE()                                                              \
  do {                                                                            \
    std::cout << "\n@@FLASH " << ::flash_internal::token()                        \
              << " {\"done\":true,\"count\":" << ::flash_internal::checks_run()   \
              << "}" << std::endl;                                                \
  } while (0)
