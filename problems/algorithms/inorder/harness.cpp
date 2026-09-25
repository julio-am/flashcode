struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  explicit TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

// @USER_CODE

TreeNode* flash_insert(TreeNode* root, int v) {
  if (!root) return new TreeNode(v);
  if (v < root->val) root->left = flash_insert(root->left, v);
  else root->right = flash_insert(root->right, v);
  return root;
}

TreeNode* flash_build(const std::vector<int>& vals) {
  TreeNode* root = nullptr;
  for (int v : vals) root = flash_insert(root, v);
  return root;
}

void flash_ref(TreeNode* n, std::vector<int>& out) {
  if (!n) return;
  flash_ref(n->left, out);
  out.push_back(n->val);
  flash_ref(n->right, out);
}

int main() {
  std::vector<std::pair<std::string, std::vector<int>>> cases{
      {"a small BST", {5, 3, 8, 1, 4}},
      {"a larger BST", {50, 30, 70, 20, 40, 60, 80, 35, 45, 65}},
      {"an empty tree", {}},
      {"a single node", {7}},
      {"a tree that only leans right", {1, 2, 3, 4, 5}}};
  for (const auto& [label, vals] : cases) {
    TreeNode* root = flash_build(vals);
    std::vector<int> got, want;
    inorder(root, got);
    flash_ref(root, want);
    CHECK_EQ(got, want, "correct order for " + label);
  }
  FLASH_DONE();
}
