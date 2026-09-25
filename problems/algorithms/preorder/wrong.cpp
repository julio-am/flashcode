void preorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  preorder(root->left, out);
  out.push_back(root->val);
  preorder(root->right, out);
}
