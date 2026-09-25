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

`flash.h` (in `/grader`) is included automatically and brings in `<bits/stdc++.h>`. It gives you:

- `CHECK(cond, "what should be true")`
- `CHECK_EQ(actual, expected, "what should be true")`, which shows both values on failure. Wrap braced literals in parentheses: `CHECK_EQ(v, (std::vector<int>{1, 2}), "...")`, because the preprocessor splits on the commas inside braces.
- `FAIL("why")`, for probes that detect something missing.
- `FLASH_DONE()`, which must be the last line of `main`. A program that exits before it is graded as a crash.

Check names are what the user reads, so write them as the expectation ("b ends with the elements of a").

## Three shapes

**Statements that change variables** (vector operations). Put the marker inside a block inside a loop over a few inputs, so a hard-coded answer fails:

```cpp
for (auto [a, b] : cases) {
  auto want = ...;
  {
    // @USER_CODE
  }
  CHECK_EQ(b, want, "b ends with the elements of a");
}
```

**A declaration the harness inspects** (initialization). Put the marker directly in `main` (or the loop body) so the variable is visible afterwards. Check behavior (push and pop a heap) rather than exact types, unless the type is the point, then use a `static_assert` with a readable message.

**Definitions at global scope** (classes, functions). Put the marker at the top level. For classes, probe with templates and `if constexpr` so a missing constructor or member becomes a `FAIL(...)` line instead of a wall of template errors; see `init/user-class`.

Keep harness helper names prefixed with `flash_` so they don't collide with the user's code. C++23 features are fair game in harnesses and answers.
