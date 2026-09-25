std::sort(v.begin(), v.end());
v.erase(std::unique(v.begin(), v.end()), v.end());
