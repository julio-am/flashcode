void inorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  out.push_back(root->val);
  inorder(root->left, out);
  inorder(root->right, out);
}
