void preorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  out.push_back(root->val);
  preorder(root->left, out);
  preorder(root->right, out);
}
