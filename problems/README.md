# Writing a problem

Each problem is a folder: `problems/<category>/<slug>/`. The category must be listed in `categories.yaml`.

| File | What it is |
| --- | --- |
| `problem.yaml` | `title`, `prompt` (plain text, `inline code` in backticks), and optional `given`: code the user can assume is already in scope. |
| `harness.cpp` | A C++ program with exactly one `// @USER_CODE` line where the answer is pasted. |
| `solution.cpp` | The reference answer. Shown when the user clicks Show solution. Must pass. |
| `wrong*.cpp` | One or more plausible mistakes. Each must *not* pass. |

`npm run verify` grades every `solution.cpp` and `wrong*.cpp`, and CI runs it too. Everything compiles as C++23.

## The harness

`flash.h` (in `/grader`) is included automatically and brings in `<bits/stdc++.h>`. Results are shown to the user as numbered test cases (Test #0, Test #1, …), each with its input, output, expected output, whatever the program printed, and a Hint button.

- `FLASH_CASE("a", a, "b", b)` opens a test case for the rest of the enclosing scope (usually one loop iteration) and records its inputs as name/value pairs. Values are rendered like `{1, 2, 3}`; a string literal is shown as-is, for descriptions such as `FLASH_CASE("push", "5, 1, 8")`.
- `CHECK_EQ(actual, expected, "hint")` shows `actual` under its own expression text (`b = {…}`) next to the expected value. Wrap braced literals in parentheses: `CHECK_EQ(v, (std::vector<int>{1, 2}), "...")`, because the preprocessor splits on the commas inside braces.
- `CHECK_OUT("label", actual, expected, "hint")` is the same with a label you choose, for when the expression is noisy.
- `CHECK(cond, "hint")` and `FAIL("hint")` are yes/no checks with no values. A failing one shows its hint as the output, so phrase it as what's missing ("User needs a public member named age").
- `FLASH_DONE()` must be the last line of `main`. A program that exits before it is graded as a crash.

A check made outside any `FLASH_CASE` becomes a test case of its own with no input. Hints are what the user reads when they ask for help, so write them as the expectation ("b should end with the elements of a").

## Three shapes

**Statements that change variables** (vector operations). Put the marker inside a block inside a loop over a few inputs, so a hard-coded answer fails:

```cpp
for (auto [a, b] : cases) {
  FLASH_CASE("a", a, "b", b);
  auto want = ...;
  {
    // @USER_CODE
  }
  CHECK_EQ(b, want, "b should end with the elements of a");
}
```

**A declaration the harness inspects** (initialization). Put the marker directly in `main` (or the loop body) so the variable is visible afterwards. Check behavior (push and pop a heap) rather than exact types, unless the type is the point, then use a `static_assert` with a readable message.

**Definitions at global scope** (classes, functions). Put the marker at the top level. For classes, probe with templates and `if constexpr` so a missing constructor or member becomes a `FAIL(...)` line instead of a wall of template errors; see `init/user-class`.

Keep harness helper names prefixed with `flash_` so they don't collide with the user's code. C++23 features are fair game in harnesses and answers.
