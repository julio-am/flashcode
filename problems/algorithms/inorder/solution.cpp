void inorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  inorder(root->left, out);
  out.push_back(root->val);
  inorder(root->right, out);
}
