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
  flash_ref(n->right, out);
  out.push_back(n->val);
}

int main() {
  std::vector<std::vector<int>> cases{
      {5, 3, 8, 1, 4}, {50, 30, 70, 20, 40, 60, 80, 35, 45, 65}, {}, {7}, {1, 2, 3, 4, 5}};
  for (const auto& vals : cases) {
    FLASH_CASE("BST built by inserting", vals);
    TreeNode* root = flash_build(vals);
    std::vector<int> out, want;
    postorder(root, out);
    flash_ref(root, want);
    CHECK_EQ(out, want, "out should list the values in postorder order (left subtree, right subtree, node)");
  }
  FLASH_DONE();
}
