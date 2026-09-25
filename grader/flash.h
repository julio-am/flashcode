// flash.h: the tiny test library every FlashCode harness includes.
//
// A harness is a list of numbered test cases. Each case records its inputs,
// then one or more checks, and every event is printed as one line:
//   @@FLASH <token> {"case":"begin","inputs":[{"name":"a","value":"{1, 2}"}]}
//   @@FLASH <token> {"ok":false,"hint":"...","label":"b","actual":"...","expected":"..."}
//   @@FLASH <token> {"case":"end"}
// FLASH_DONE() prints a final line with the number of checks run.
// Anything else the program prints between a case's begin and end is that
// case's console output. The token is read from stdin at startup, so output
// the user prints (or fakes) without knowing it is ignored by the grader.
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

inline bool& in_case() {
  static bool b = false;
  return b;
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

inline std::string quote(const std::string& s) { return "\"" + json_escape(s) + "\""; }

inline void line(const std::string& json) {
  std::cout << "\n@@FLASH " << token() << " " << json << std::endl;
}

// show(x): readable rendering of inputs and outputs.
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

// A string literal passed as an input value is shown as-is (a description),
// not quoted like a std::string value.
inline std::string show_input(const char* text) { return text; }
template <class T>
std::string show_input(const T& v) {
  return show(v);
}

inline void begin_case(const std::string& inputs_json) {
  in_case() = true;
  line("{\"case\":\"begin\",\"inputs\":[" + inputs_json + "]}");
}

inline void end_case() {
  in_case() = false;
  line("{\"case\":\"end\"}");
}

inline void add_inputs(std::string&) {}
template <class V, class... Rest>
void add_inputs(std::string& out, const char* name, const V& value, const Rest&... rest) {
  if (!out.empty()) out += ",";
  out += "{\"name\":" + quote(name) + ",\"value\":" + quote(show_input(value)) + "}";
  add_inputs(out, rest...);
}

// FLASH_CASE("a", a, "b", b) opens a test case for the rest of the enclosing
// scope (usually one loop iteration) and records its inputs.
struct CaseGuard {
  template <class... Args>
  explicit CaseGuard(const Args&... args) {
    static_assert(sizeof...(Args) % 2 == 0, "FLASH_CASE takes name, value pairs");
    std::string inputs;
    add_inputs(inputs, args...);
    begin_case(inputs);
  }
  ~CaseGuard() { end_case(); }
  CaseGuard(const CaseGuard&) = delete;
  CaseGuard& operator=(const CaseGuard&) = delete;
};

// A check made outside any FLASH_CASE becomes a case of its own.
inline void check(bool ok, const std::string& hint, const std::string& label, const std::string& actual,
                  const std::string& expected, bool has_values) {
  bool standalone = !in_case();
  if (standalone) begin_case("");
  ++checks_run();
  std::string json = "{\"ok\":" + std::string(ok ? "true" : "false") + ",\"hint\":" + quote(hint);
  if (has_values) {
    json += ",\"label\":" + quote(label) + ",\"actual\":" + quote(actual) + ",\"expected\":" + quote(expected);
  }
  line(json + "}");
  if (standalone) end_case();
}

}  // namespace flash_internal

#define FLASH_CAT2(a, b) a##b
#define FLASH_CAT(a, b) FLASH_CAT2(a, b)

#define FLASH_CASE(...) ::flash_internal::CaseGuard FLASH_CAT(flash_case_, __LINE__)(__VA_ARGS__)

// CHECK(condition, "hint"): a yes/no check with no values to show.
#define CHECK(cond, hint) ::flash_internal::check(static_cast<bool>(cond), (hint), "", "", "", false)

// CHECK_OUT("label", actual, expected, "hint"): shows the label with actual and expected values.
#define CHECK_OUT(label, actual, expected, hint)                                              \
  do {                                                                                         \
    const auto& flash_a_ = (actual);                                                           \
    const auto& flash_e_ = (expected);                                                         \
    ::flash_internal::check(flash_a_ == flash_e_, (hint), (label), ::flash_internal::show(flash_a_), \
                            ::flash_internal::show(flash_e_), true);                           \
  } while (0)

// CHECK_EQ(actual, expected, "hint"): CHECK_OUT labelled with the actual expression's text.
#define CHECK_EQ(actual, expected, hint) CHECK_OUT(#actual, actual, expected, hint)

// FAIL("why"): a check that always fails, for probes that detect missing pieces.
#define FAIL(hint) CHECK(false, hint)

// FLASH_DONE(): must be the last thing main() does. No DONE line means the
// program crashed or exited early, which the grader treats as a failure.
#define FLASH_DONE() \
  ::flash_internal::line("{\"done\":true,\"count\":" + std::to_string(::flash_internal::checks_run()) + "}")
