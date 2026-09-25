void postorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  postorder(root->left, out);
  postorder(root->right, out);
  out.push_back(root->val);
}
