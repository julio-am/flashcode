void postorder(TreeNode* root, std::vector<int>& out) {
  if (!root) return;
  out.push_back(root->val);
  postorder(root->right, out);
  postorder(root->left, out);
}
